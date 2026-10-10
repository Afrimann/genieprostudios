"use client";

import { useCallback, useEffect, useState } from "react";

import { createClient as createBrowserClient } from "@/lib/supabase/client";
import type { Service } from "@/lib/repositories/service-repository";
import type { Booking } from "@/lib/services/booking-service";
import type { StartTimeOption } from "@/lib/services/availability-service";
import {
  createAddonBooking,
  createPendingBooking,
  fetchServices,
  fetchValidStartTimes,
  saveBookingTrack,
} from "@/lib/services/booking-flow-actions";

export type BookingStep =
  | "service"
  | "songs"
  | "date"
  | "startTime"
  | "equipment"
  | "summary";

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

/**
 * Thin React-facing glue for the customer booking flow (Component -> Hook
 * -> Service, per project-notes.md). Owns step state and delegates every
 * data read/mutation to the Server Actions in
 * lib/services/booking-flow-actions.ts — never calls a repository or
 * Supabase client directly. Components consuming this hook stay
 * presentational: they render {step, data, loading, error} and call the
 * actions this hook exposes.
 *
 * 0036/0037 note: every date is open by default now — there is no more
 * admin-opened "window" concept (the old AvailabilitySlot/"window" step is
 * gone). selectDate goes straight from the "date" step to loading
 * date-scoped valid start times (fetchValidStartTimes(date, serviceId)) for
 * the "startTime" step. A new read-only "equipment" step sits between
 * "startTime" and "summary" — same is_addon skip rule as the date/startTime
 * steps (see startBookingForService below).
 */
export function useBookingFlow(initialServiceId?: string) {
  const [step, setStep] = useState<BookingStep>("service");

  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);

  const [selectedService, setSelectedService] = useState<Service | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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

  const loadStartTimesForDate = useCallback(
    async (date: string, serviceId: string) => {
      setStartTimesLoading(true);
      setStartTimesError(null);

      const result = await fetchValidStartTimes(date, serviceId);
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

  /**
   * Shared by selectService (customer clicks a package) and the mount
   * effect's initialServiceId pre-select (arriving via /book?service=...).
   * is_addon services (e.g. per-song mixing/mastering, duration_hours = 0 —
   * see 0002_services.sql) have no studio room time to reserve at all, so
   * they skip the date -> startTime -> equipment steps entirely and go to the
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
    },
    [],
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

  /**
   * Every date is open by default now (0036/0037) — there is no window step
   * to pass through, so picking a date goes straight to loading that date's
   * valid start times for the "startTime" step.
   */
  function selectDate(date: string) {
    if (!selectedService) return;

    setSelectedDate(date);
    setStep("startTime");
    loadStartTimesForDate(date, selectedService.id);
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

    setSelectedDate(null);

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
    setStartTimeOptions([]);
    setStartTimesError(null);
  }

  /**
   * Read-only "equipment" step, inserted between "startTime" and "summary"
   * (skipped for is_addon services, same as date/startTime) — nothing is
   * written to the booking here, so there's no corresponding
   * select/submit, just a forward transition once the customer has seen
   * the inventory list.
   */
  function continueFromEquipment() {
    setStep("summary");
  }

  async function selectStartTime(option: StartTimeOption) {
    if (!selectedService || !selectedDate) return;

    setBookingSubmitting(true);
    setBookingError(null);

    const result = await createPendingBooking(
      selectedDate,
      selectedService.id,
      option.startTime,
    );
    setBookingSubmitting(false);

    if (!result.success) {
      setBookingError(result.message);

      // Any failure (most notably time_unavailable — someone else just
      // booked overlapping time) bounces back to a fresh start-time fetch
      // for the same date so a just-taken time disappears immediately — no
      // double-booking in the UI, per project-notes.md.
      if (selectedDate && selectedService) {
        loadStartTimesForDate(selectedDate, selectedService.id);
      }
      return;
    }

    setBooking(result.booking);
    setStep("equipment");
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

    selectedDate,
    selectDate,
    backToService,

    startTimeOptions,
    startTimesLoading,
    startTimesError,
    selectStartTime,
    backToDate,

    continueFromEquipment,
    resetFlow,

    bookingSubmitting,
    bookingError,
    booking,
  };
}
