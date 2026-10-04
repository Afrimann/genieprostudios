"use client";

import { useCallback, useEffect, useState } from "react";

import { createClient as createBrowserClient } from "@/lib/supabase/client";
import type { Service } from "@/lib/repositories/service-repository";
import type { AvailabilitySlot } from "@/lib/repositories/availability-repository";
import type { Booking } from "@/lib/services/booking-service";
import type { StartTimeOption } from "@/lib/services/availability-service";
import {
  createAddonBooking,
  createPendingBooking,
  fetchOpenDates,
  fetchOpenSlots,
  fetchServices,
  fetchValidStartTimes,
  saveBookingTrack,
} from "@/lib/services/booking-flow-actions";

export type BookingStep = "service" | "songs" | "date" | "window" | "startTime" | "summary";

// Per-song upload progress, indexed the same as the songs array passed to
// submitAddonSongs — "done" entries are skipped on retry so a failed song
// doesn't force re-uploading everything before it.
export type SongUploadStatus = "idle" | "uploading" | "saving" | "done" | "error";

export type AddonSongInput = { title: string; file: File };

// Real bug found in production (2026-09-28): an oversized upload to
// Supabase Storage doesn't fail cleanly — it can hang indefinitely with no
// error and no feedback, leaving the "Submitting…" button stuck forever.
// lib/validation/addon-songs.ts's MAX_FILE_SIZE_BYTES is the primary
// defense (rejects an oversized file before ever attempting the upload);
// this timeout is the safety net for a legitimately-sized file stuck on a
// slow/broken connection, so a customer always gets a clear, actionable
// error instead of an unbounded wait.
const UPLOAD_TIMEOUT_MS = 60_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("upload_timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

// How far ahead the date picker looks for open dates. 60 days is a
// reasonable planning horizon for a studio booking that doesn't (yet) need
// to be configurable.
const DATE_RANGE_DAYS = 60;

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Thin React-facing glue for the customer booking flow (Component -> Hook
 * -> Service, per project-notes.md). Owns step state and delegates every
 * data read/mutation to the Server Actions in
 * lib/services/booking-flow-actions.ts — never calls a repository or
 * Supabase client directly. Components consuming this hook stay
 * presentational: they render {step, data, loading, error} and call the
 * actions this hook exposes.
 *
 * 0014 note: "slot" now means a continuous admin-opened *window*
 * (AvailabilitySlot), not a single bookable unit. The step machine grew a
 * "window" step (pick which window, skipped automatically when a date has
 * exactly one) and a "startTime" step (pick a 30-minute-grid-aligned start
 * time inside the chosen window, computed server-side by
 * fetchValidStartTimes) in place of the old flat "slot" step.
 */
export function useBookingFlow(initialServiceId?: string) {
  const [step, setStep] = useState<BookingStep>("service");

  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);

  const [selectedService, setSelectedService] = useState<Service | null>(null);

  const [openDates, setOpenDates] = useState<string[]>([]);
  const [datesLoading, setDatesLoading] = useState(false);
  const [datesError, setDatesError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [windows, setWindows] = useState<AvailabilitySlot[]>([]);
  const [windowsLoading, setWindowsLoading] = useState(false);
  const [windowsError, setWindowsError] = useState<string | null>(null);

  const [selectedWindow, setSelectedWindow] = useState<AvailabilitySlot | null>(null);

  const [startTimeOptions, setStartTimeOptions] = useState<StartTimeOption[]>([]);
  const [startTimesLoading, setStartTimesLoading] = useState(false);
  const [startTimesError, setStartTimesError] = useState<string | null>(null);

  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);

  // Addon (per-song) flow only. addonBookingId/addonCustomerId persist across
  // a failed submitAddonSongs call so a retry reuses the same booking instead
  // of creating a new one every time a song fails to upload.
  const [addonBookingId, setAddonBookingId] = useState<string | null>(null);
  const [addonCustomerId, setAddonCustomerId] = useState<string | null>(null);
  const [songStatuses, setSongStatuses] = useState<SongUploadStatus[]>([]);
  const [songErrorMessages, setSongErrorMessages] = useState<(string | null)[]>([]);

  const loadOpenDates = useCallback(async () => {
    setDatesLoading(true);
    setDatesError(null);

    const today = new Date();
    const end = new Date();
    end.setDate(end.getDate() + DATE_RANGE_DAYS);

    const result = await fetchOpenDates(toIsoDate(today), toIsoDate(end));
    setDatesLoading(false);

    if (!result.success) {
      setDatesError(result.message);
      return;
    }

    setOpenDates(result.dates);
  }, []);

  const loadStartTimesForWindow = useCallback(
    async (windowId: string, serviceId: string) => {
      setStartTimesLoading(true);
      setStartTimesError(null);

      const result = await fetchValidStartTimes(windowId, serviceId);
      setStartTimesLoading(false);

      if (!result.success) {
        setStartTimesError(result.message);
        setStartTimeOptions([]);
        return;
      }

      setStartTimeOptions(result.options);
    },
    [],
  );

  // Moves to the start-time step for a chosen window and kicks off its
  // fetch — called directly (never from an effect) both when a window is
  // explicitly picked and when loadWindowsForDate auto-selects the sole
  // window for a date, so there's exactly one place that performs this
  // transition.
  const chooseWindow = useCallback(
    (window: AvailabilitySlot, serviceId: string) => {
      setSelectedWindow(window);
      setStep("startTime");
      loadStartTimesForWindow(window.id, serviceId);
    },
    [loadStartTimesForWindow],
  );

  /**
   * Loads the open windows for a date. If there's exactly one, auto-selects
   * it and skips straight to the start-time step (one fewer click for the
   * common case); if there's more than one, stays on the "window" step so
   * the customer can pick which one. Also used to refresh the window list
   * after a booking attempt so a window whose only remaining gaps got
   * consumed doesn't linger looking pristine.
   */
  const loadWindowsForDate = useCallback(
    async (date: string, serviceId: string) => {
      setWindowsLoading(true);
      setWindowsError(null);

      const result = await fetchOpenSlots(date);
      setWindowsLoading(false);

      if (!result.success) {
        setWindowsError(result.message);
        setWindows([]);
        return;
      }

      setWindows(result.slots);

      if (result.slots.length === 1) {
        chooseWindow(result.slots[0], serviceId);
      }
    },
    [chooseWindow],
  );

  /**
   * Shared by selectService (customer clicks a package) and the mount
   * effect's initialServiceId pre-select (arriving via /book?service=...).
   * is_addon services (e.g. per-song mixing/mastering, duration_hours = 0 —
   * see 0002_services.sql) have no studio room time to reserve at all, so
   * they skip the date -> window -> start-time steps entirely and go to the
   * "songs" step instead, where the customer supplies contact info plus a
   * title + WAV file per song. The booking itself isn't created yet here —
   * its price depends on how many songs the customer submits, so creation
   * is deferred to submitAddonSongs below.
   */
  const startBookingForService = useCallback(
    async (service: Service) => {
      setSelectedService(service);
      setBookingError(null);

      if (service.is_addon) {
        setAddonBookingId(null);
        setAddonCustomerId(null);
        setSongStatuses([]);
        setSongErrorMessages([]);
        setStep("songs");
        return;
      }

      setStep("date");
      loadOpenDates();
    },
    [loadOpenDates],
  );

  /**
   * Submits the "songs" step: creates the addon booking on first call
   * (priced at price_kobo * songs.length), then uploads each song's file
   * directly to the track-uploads storage bucket from the browser (never
   * through a Server Action — real WAV files would exceed typical body-size
   * limits) and records it via saveBookingTrack. Safe to call again after a
   * partial failure — already-"done" songs are skipped, and the same
   * addonBookingId is reused rather than creating a duplicate booking.
   */
  const submitAddonSongs = useCallback(
    async (contactName: string, contactEmail: string, songs: AddonSongInput[]) => {
      if (!selectedService) return;

      setBookingSubmitting(true);
      setBookingError(null);

      let bookingId = addonBookingId;
      let customerId = addonCustomerId;
      let statuses = songStatuses;
      let errors = songErrorMessages;

      if (!bookingId) {
        const result = await createAddonBooking(
          selectedService.id,
          songs.length,
          contactName,
          contactEmail,
        );

        if (!result.success) {
          setBookingSubmitting(false);
          setBookingError(result.message);
          return;
        }

        bookingId = result.booking.id;
        customerId = result.booking.customer_id;
        statuses = songs.map(() => "idle");
        errors = songs.map(() => null);

        setAddonBookingId(bookingId);
        setAddonCustomerId(customerId);
        setBooking(result.booking);
        setSongStatuses(statuses);
        setSongErrorMessages(errors);
      }

      const nextStatuses = [...statuses];
      const nextErrors = [...errors];

      for (let i = 0; i < songs.length; i++) {
        if (nextStatuses[i] === "done") continue;

        const song = songs[i];
        const safeName = song.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${customerId}/${bookingId}/${i}-${safeName}`;

        nextStatuses[i] = "uploading";
        nextErrors[i] = null;
        setSongStatuses([...nextStatuses]);
        setSongErrorMessages([...nextErrors]);

        const supabase = createBrowserClient();
        let uploadError: { message: string } | null = null;
        try {
          const result = await withTimeout(
            supabase.storage
              .from("track-uploads")
              .upload(path, song.file, { upsert: true, contentType: "audio/wav" }),
            UPLOAD_TIMEOUT_MS,
          );
          uploadError = result.error;
        } catch {
          // Either the timeout above fired, or the upload call itself threw
          // (e.g. a network error) — both are the same "stuck/failed, let
          // the customer retry" case from the UI's perspective.
          nextStatuses[i] = "error";
          nextErrors[i] = "Upload timed out — check your connection and try again.";
          setSongStatuses([...nextStatuses]);
          setSongErrorMessages([...nextErrors]);
          setBookingSubmitting(false);
          return;
        }

        if (uploadError) {
          nextStatuses[i] = "error";
          nextErrors[i] = "Upload failed — please try again.";
          setSongStatuses([...nextStatuses]);
          setSongErrorMessages([...nextErrors]);
          setBookingSubmitting(false);
          return;
        }

        nextStatuses[i] = "saving";
        setSongStatuses([...nextStatuses]);

        const saveResult = await saveBookingTrack({
          bookingId,
          position: i,
          title: song.title,
          filePath: path,
          fileName: song.file.name,
        });

        if (!saveResult.success) {
          nextStatuses[i] = "error";
          nextErrors[i] = saveResult.message;
          setSongStatuses([...nextStatuses]);
          setSongErrorMessages([...nextErrors]);
          setBookingSubmitting(false);
          return;
        }

        nextStatuses[i] = "done";
        setSongStatuses([...nextStatuses]);
      }

      setBookingSubmitting(false);
      setStep("summary");
    },
    [selectedService, addonBookingId, addonCustomerId, songStatuses, songErrorMessages],
  );

  // Load services once on mount.
  useEffect(() => {
    let active = true;

    async function load() {
      setServicesLoading(true);
      setServicesError(null);
      const result = await fetchServices();
      if (!active) return;
      setServicesLoading(false);

      if (!result.success) {
        setServicesError(result.message);
        return;
      }

      setServices(result.services);

      if (initialServiceId) {
        const match = result.services.find((s) => s.id === initialServiceId);
        if (match) {
          startBookingForService(match);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
    // initialServiceId is only meant to apply on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectService(service: Service) {
    startBookingForService(service);
  }

  function selectDate(date: string) {
    if (!selectedService) return;

    setSelectedDate(date);
    setSelectedWindow(null);
    setStep("window");
    loadWindowsForDate(date, selectedService.id);
  }

  function selectWindow(window: AvailabilitySlot) {
    if (!selectedService) return;
    chooseWindow(window, selectedService.id);
  }

  function backToService() {
    setStep("service");
  }

  /**
   * Full reset to a fresh flow — every selection, every loaded list, every
   * error, and the created booking itself.
   *
   * Distinct from backToService() above, which only rewinds `step` and
   * deliberately keeps the customer's picks so they can step forward again
   * without re-choosing. That's right for a "back" button and wrong for a
   * cancel: after cancelling, the booking row no longer exists, so holding
   * on to `booking`/`addonBookingId` would leave the UI referencing a
   * record that's gone (2026-10-04 bug — cancelling from the summary step
   * left the whole form populated, because CancelBookingButton's
   * router.push("/book") can't remount a client component already mounted
   * on /book).
   *
   * `services` is intentionally NOT cleared: it's the static catalogue, not
   * a user selection, and refetching it would flash an avoidable loading
   * state on the very step we're returning to.
   */
  function resetFlow() {
    setStep("service");

    setSelectedService(null);

    setOpenDates([]);
    setDatesLoading(false);
    setDatesError(null);
    setSelectedDate(null);

    setWindows([]);
    setWindowsLoading(false);
    setWindowsError(null);
    setSelectedWindow(null);

    setStartTimeOptions([]);
    setStartTimesLoading(false);
    setStartTimesError(null);

    setBooking(null);
    setBookingError(null);
    setBookingSubmitting(false);

    setAddonBookingId(null);
    setAddonCustomerId(null);
    setSongStatuses([]);
    setSongErrorMessages([]);
  }

  function backToDate() {
    setStep("date");
    setSelectedWindow(null);
    setWindows([]);
  }

  function backToWindow() {
    setStep("window");
    setStartTimeOptions([]);
    setStartTimesError(null);
  }

  async function selectStartTime(option: StartTimeOption) {
    if (!selectedService || !selectedWindow) return;

    setBookingSubmitting(true);
    setBookingError(null);

    const result = await createPendingBooking(
      selectedWindow.id,
      selectedService.id,
      option.startTime,
    );
    setBookingSubmitting(false);

    if (!result.success) {
      setBookingError(result.message);

      // Any failure (most notably time_unavailable — someone else just
      // booked overlapping time) bounces back to a fresh start-time fetch
      // so a just-taken time disappears immediately — no double-booking in
      // the UI, per project-notes.md. slot_taken (window itself closed in
      // the meantime) instead falls back to re-loading the window list for
      // the date, since the window itself is no longer valid.
      if (result.error === "slot_taken" && selectedDate) {
        setSelectedWindow(null);
        setStep("window");
        loadWindowsForDate(selectedDate, selectedService.id);
        return;
      }

      if (selectedWindow && selectedService) {
        loadStartTimesForWindow(selectedWindow.id, selectedService.id);
      }
      return;
    }

    setBooking(result.booking);
    setStep("summary");
  }

  return {
    step,

    services,
    servicesLoading,
    servicesError,
    selectedService,
    selectService,

    songStatuses,
    songErrorMessages,
    submitAddonSongs,

    openDates,
    datesLoading,
    datesError,
    selectedDate,
    selectDate,
    backToService,

    windows,
    windowsLoading,
    windowsError,
    selectedWindow,
    selectWindow,
    backToDate,

    startTimeOptions,
    startTimesLoading,
    startTimesError,
    selectStartTime,
    backToWindow,
    resetFlow,

    bookingSubmitting,
    bookingError,
    booking,
  };
}
