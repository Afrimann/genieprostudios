"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useBookingFlow } from "@/lib/hooks/use-booking-flow";
import { formatKobo } from "@/lib/utils/money";
import { consentFormSchema, type ConsentFormValues } from "@/lib/validation/consent";
import { recordTcAcceptance } from "@/lib/services/tc-service";
import { initializePayment, type PaymentChoice } from "@/lib/services/payment-service";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function formatTimeRange(start: string, end: string): string {
  return `${start.slice(0, 5)} – ${end.slice(0, 5)}`;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

interface BookingFlowProps {
  initialServiceId?: string;
}

export function BookingFlow({ initialServiceId }: BookingFlowProps) {
  const flow = useBookingFlow(initialServiceId);

  return (
    <div className="flex flex-col gap-6">
      <Steps current={flow.step} />

      {flow.step === "service" && (
        <Card>
          <CardHeader>
            <CardTitle>Choose a service</CardTitle>
            <CardDescription>Pick the session you&apos;d like to book.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {flow.servicesLoading && (
              <p className="text-sm text-muted-foreground">Loading services…</p>
            )}
            {flow.servicesError && (
              <p className="text-sm text-destructive">{flow.servicesError}</p>
            )}
            {!flow.servicesLoading &&
              !flow.servicesError &&
              flow.services.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => flow.selectService(service)}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-left transition-colors hover:bg-muted"
                >
                  <div>
                    <p className="font-medium">{service.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {service.is_addon
                        ? "Priced per song"
                        : `${service.duration_hours} hour${service.duration_hours === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <p className="font-semibold">{formatKobo(service.price_kobo)}</p>
                </button>
              ))}
          </CardContent>
        </Card>
      )}

      {flow.step === "date" && flow.selectedService && (
        <Card className="w-fit">
          <CardHeader>
            <CardTitle>Choose a date</CardTitle>
            <CardDescription>
              Booking: {flow.selectedService.label}. Only open dates are selectable.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {flow.datesLoading && (
              <p className="text-sm text-muted-foreground">Loading availability…</p>
            )}
            {flow.datesError && <p className="text-sm text-destructive">{flow.datesError}</p>}

            {!flow.datesLoading && !flow.datesError && (
              <Calendar
                mode="single"
                selected={flow.selectedDate ? parseIsoDate(flow.selectedDate) : undefined}
                onSelect={(date) => date && flow.selectDate(toIsoDate(date))}
                disabled={(date) => !flow.openDates.includes(toIsoDate(date))}
              />
            )}

            <Button variant="outline" onClick={flow.backToService} className="w-fit">
              Back
            </Button>
          </CardContent>
        </Card>
      )}

      {flow.step === "window" && flow.selectedService && flow.selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle>Choose a time window</CardTitle>
            <CardDescription>
              Open windows on {flow.selectedDate} for {flow.selectedService.label}.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {flow.windowsLoading && (
              <p className="text-sm text-muted-foreground">Loading windows…</p>
            )}
            {flow.windowsError && (
              <p className="text-sm text-destructive">{flow.windowsError}</p>
            )}

            {!flow.windowsLoading && !flow.windowsError && flow.windows.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No open windows left for this date — please pick another date.
              </p>
            )}

            {!flow.windowsLoading &&
              flow.windows.length > 1 &&
              flow.windows.map((window) => (
                <button
                  key={window.id}
                  type="button"
                  onClick={() => flow.selectWindow(window)}
                  className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-left transition-colors hover:bg-muted"
                >
                  <span className="font-medium">
                    {formatTimeRange(window.start_time, window.end_time)}
                  </span>
                  <Badge>open</Badge>
                </button>
              ))}

            <Button variant="outline" onClick={flow.backToDate} className="w-fit">
              Back
            </Button>
          </CardContent>
        </Card>
      )}

      {flow.step === "startTime" && flow.selectedService && flow.selectedWindow && (
        <Card>
          <CardHeader>
            <CardTitle>Choose a start time</CardTitle>
            <CardDescription>
              Window {formatTimeRange(flow.selectedWindow.start_time, flow.selectedWindow.end_time)} on{" "}
              {flow.selectedDate} for {flow.selectedService.label} (
              {flow.selectedService.duration_hours} hour
              {flow.selectedService.duration_hours === 1 ? "" : "s"}).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {flow.startTimesLoading && (
              <p className="text-sm text-muted-foreground">Loading available start times…</p>
            )}
            {flow.startTimesError && (
              <p className="text-sm text-destructive">{flow.startTimesError}</p>
            )}
            {flow.bookingError && (
              <p className="text-sm text-destructive">{flow.bookingError}</p>
            )}

            {!flow.startTimesLoading &&
              !flow.startTimesError &&
              flow.startTimeOptions.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No available start times in this window for this service — try another
                  date or window.
                </p>
              )}

            {!flow.startTimesLoading &&
              flow.startTimeOptions.map((option) => (
                <button
                  key={option.startTime}
                  type="button"
                  disabled={flow.bookingSubmitting}
                  onClick={() => flow.selectStartTime(option)}
                  className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-left transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                >
                  <span className="font-medium">
                    {formatTimeRange(option.startTime, option.endTime)}
                  </span>
                  <Badge>open</Badge>
                </button>
              ))}

            <Button
              variant="outline"
              onClick={flow.backToWindow}
              disabled={flow.bookingSubmitting}
              className="w-fit"
            >
              Back
            </Button>
          </CardContent>
        </Card>
      )}

      {flow.step === "summary" && flow.booking && flow.selectedService && (
        <BookingSummaryStep
          booking={flow.booking}
          serviceLabel={flow.selectedService.label}
        />
      )}
    </div>
  );
}

type SummaryBooking = {
  id: string;
  session_date: string;
  session_start_time: string;
  session_end_time: string;
  total_price_kobo: number;
  deposit_amount_kobo: number;
};

function BookingSummaryStep({
  booking,
  serviceLabel,
}: {
  booking: SummaryBooking;
  serviceLabel: string;
}) {
  // Local-only state for this step — deliberately not folded into
  // useBookingFlow's step machine per the task brief: consent/payment are
  // this step's own concern, not part of the shared service -> date -> slot
  // -> summary progression.
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentSubmitting, setConsentSubmitting] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  const [paymentSubmitting, setPaymentSubmitting] = useState<PaymentChoice | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ConsentFormValues>({
    resolver: zodResolver(consentFormSchema),
    defaultValues: { agreed: false as unknown as true },
  });

  async function onAgree() {
    setConsentError(null);
    setConsentSubmitting(true);

    const result = await recordTcAcceptance(booking.id);

    setConsentSubmitting(false);

    if (!result.success) {
      setConsentError(result.message);
      return;
    }

    setConsentAccepted(true);
  }

  async function handlePayment(choice: PaymentChoice) {
    setPaymentError(null);
    setPaymentSubmitting(choice);

    const result = await initializePayment(booking.id, choice);

    if (!result.success) {
      setPaymentSubmitting(null);
      setPaymentError(result.message);
      return;
    }

    // Real navigation away from the SPA — Paystack's checkout page lives
    // outside this app, so this is intentionally not client-side routing.
    window.location.href = result.authorizationUrl;
  }

  const isPaying = paymentSubmitting !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>You&apos;re almost there</CardTitle>
        <CardDescription>
          You selected {serviceLabel} on {booking.session_date} at{" "}
          {formatTimeRange(booking.session_start_time, booking.session_end_time)}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 text-sm">
        <div className="flex flex-col gap-2">
          <p>
            Total price: <span className="font-semibold">{formatKobo(booking.total_price_kobo)}</span>
          </p>
          <p>
            Deposit due (70%):{" "}
            <span className="font-semibold">{formatKobo(booking.deposit_amount_kobo)}</span>
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <p className="font-medium">Terms &amp; Conditions</p>

          {/* Shortened summary of the real Guidelines & Terms (app/terms/page.tsx) — kept in sync with that page's numbered list, not independent placeholder copy. */}
          <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-3 text-xs text-muted-foreground">
            <p>
              A minimum 70% deposit secures this booking; the remaining balance is due
              before studio access, no later than 24 hours before your session. Missed
              sessions without prior notice are non-refundable, and a session is
              cancelled without refund after a 35-minute no-call-no-show — please reach
              out if you&apos;re running late so your session can be rescheduled.
              Rescheduling a session in advance attracts a charge of 25% of the stated
              price. Arrive 30 minutes early for sound checks — after 30 minutes, your
              booked time counts down regardless, and additional setup time is charged
              at ₦25,000/hour. Booked time is strictly adhered to; only bottled water is
              permitted in the studio. This is a shortened summary —{" "}
              <Link href="/terms" className="underline underline-offset-2">
                read the full terms
              </Link>{" "}
              for the complete, governing agreement.
            </p>
          </div>

          <form
            onSubmit={handleSubmit(onAgree)}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <Controller
                name="agreed"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="agreed"
                    checked={field.value === true}
                    disabled={consentAccepted || consentSubmitting}
                    aria-invalid={!!errors.agreed}
                    onCheckedChange={(checked) => {
                      field.onChange(checked === true);
                      // Submit as soon as the box is checked (and passes
                      // validation) rather than requiring a separate
                      // "Confirm" click — unchecking just resets local
                      // state, it does not un-record an acceptance already
                      // saved server-side.
                      if (checked === true) {
                        handleSubmit(onAgree)();
                      }
                    }}
                  />
                )}
              />
              <Label htmlFor="agreed" className="font-normal">
                I have read and agree to the terms and conditions above.
              </Label>
            </div>

            {errors.agreed && (
              <p className="text-sm text-destructive">{errors.agreed.message}</p>
            )}
            {consentError && (
              <p className="text-sm text-destructive">
                Could not record your acceptance: {consentError}
              </p>
            )}
            {consentSubmitting && (
              <p className="text-sm text-muted-foreground">Recording your acceptance…</p>
            )}
            {consentAccepted && (
              <p className="text-sm text-emerald-600">Terms accepted — you can proceed to payment.</p>
            )}
          </form>
        </div>

        <div className="flex flex-col gap-3">
          <p className="font-medium">
            {consentAccepted ? "Choose how to pay" : "Payment (locked until you accept the terms above)"}
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              disabled={!consentAccepted || isPaying}
              onClick={() => handlePayment("minimum")}
              className="sm:flex-1"
            >
              {paymentSubmitting === "minimum"
                ? "Redirecting…"
                : `Pay minimum deposit (${formatKobo(booking.deposit_amount_kobo)})`}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!consentAccepted || isPaying}
              onClick={() => handlePayment("full")}
              className="sm:flex-1"
            >
              {paymentSubmitting === "full"
                ? "Redirecting…"
                : `Pay in full (${formatKobo(booking.total_price_kobo)})`}
            </Button>
          </div>

          {paymentError && <p className="text-sm text-destructive">{paymentError}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function Steps({
  current,
}: {
  current: "service" | "date" | "window" | "startTime" | "summary";
}) {
  // "window" and "startTime" are both shown under the single "Time" label —
  // the window pick is often auto-skipped (single-window dates), so a
  // separate progress entry for it would be confusing/inconsistent.
  const steps: { keys: typeof current[]; label: string }[] = [
    { keys: ["service"], label: "Service" },
    { keys: ["date"], label: "Date" },
    { keys: ["window", "startTime"], label: "Time" },
    { keys: ["summary"], label: "Summary" },
  ];

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-2">
          <span
            className={step.keys.includes(current) ? "font-semibold text-foreground" : ""}
          >
            {step.label}
          </span>
          {i < steps.length - 1 && <span>→</span>}
        </div>
      ))}
    </div>
  );
}
