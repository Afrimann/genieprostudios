"use client";

import { useCallback, useEffect, useState } from "react";

import type { Service } from "@/lib/repositories/service-repository";
import type { AvailabilitySlot } from "@/lib/repositories/availability-repository";
import type { Booking } from "@/lib/services/booking-service";
import type { StartTimeOption } from "@/lib/services/availability-service";
import {
  createPendingBooking,
  fetchOpenDates,
  fetchOpenSlots,
  fetchServices,
  fetchValidStartTimes,
} from "@/lib/services/booking-flow-actions";

export type BookingStep = "service" | "date" | "window" | "startTime" | "summary";

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
          setSelectedService(match);
          setStep("date");
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

  function selectService(service: Service) {
    setSelectedService(service);
    setStep("date");
    loadOpenDates();
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

    bookingSubmitting,
    bookingError,
    booking,
  };
}
