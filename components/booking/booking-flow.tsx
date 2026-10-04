"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";

import { useBookingFlow, type BookingStep } from "@/lib/hooks/use-booking-flow";
import { useResetOnPageShow } from "@/lib/hooks/use-reset-on-pageshow";
import type { Service } from "@/lib/repositories/service-repository";
import type { AvailabilitySlot } from "@/lib/repositories/availability-repository";
import { buildPackageCatalog } from "@/lib/services/package-catalog";
import { formatKobo } from "@/lib/utils/money";
import { consentFormSchema, type ConsentFormValues } from "@/lib/validation/consent";
import { recordTcAcceptance } from "@/lib/services/tc-service";
import { initializePayment, type PaymentChoice } from "@/lib/services/payment-service";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PackageCard } from "@/components/booking/package-card";
import { AddonSongsStep } from "@/components/booking/addon-songs-step";
import { CancelBookingButton } from "@/components/dashboard/cancel-booking-button";
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

/**
 * Two-column shell used by every step past "service" (date, window,
 * startTime, summary) — the interactive step content on the left, a
 * running recap of what's been picked so far on the right, so the page
 * uses its full width instead of a single narrow left-aligned card with a
 * blank right half.
 */
function StepLayout({
  children,
  sidebar,
}: {
  children: React.ReactNode;
  sidebar: React.ReactNode;
}) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">
      <div className="flex flex-col gap-4">{children}</div>
      <div className="lg:sticky lg:top-24">{sidebar}</div>
    </div>
  );
}

function SelectionSidebar({
  service,
  date,
  window,
  chosenTime,
  songCount,
}: {
  service: Service;
  date?: string | null;
  window?: AvailabilitySlot | null;
  chosenTime?: { start: string; end: string } | null;
  // Set only once an addon booking's song count is known (after
  // submitAddonSongs creates the booking) — swaps the per-song "Price" row
  // for a "Songs" count + the real multiplied total.
  songCount?: number;
}) {
  return (
    <aside className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <p className="text-xs font-medium tracking-[0.15em] text-muted-foreground uppercase">
        Your selection
      </p>

      <div className="flex flex-col gap-3 text-sm">
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">Package</span>
          <span className="text-right font-medium text-foreground">{service.label}</span>
        </div>
        {songCount ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Songs</span>
              <span className="font-medium text-foreground">{songCount}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Total</span>
              <span className="font-mono font-semibold text-foreground">
                {formatKobo(service.price_kobo * songCount)}
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Price</span>
            <span className="font-mono font-semibold text-foreground">
              {formatKobo(service.price_kobo)}
            </span>
          </div>
        )}
        {date && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Date</span>
            <span className="font-medium text-foreground">{date}</span>
          </div>
        )}
        {chosenTime ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Time</span>
            <span className="font-medium text-foreground">
              {formatTimeRange(chosenTime.start, chosenTime.end)}
            </span>
          </div>
        ) : (
          window && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Window</span>
              <span className="font-medium text-foreground">
                {formatTimeRange(window.start_time, window.end_time)}
              </span>
            </div>
          )
        )}
      </div>
    </aside>
  );
}

interface BookingFlowProps {
  initialServiceId?: string;
}

export function BookingFlow({ initialServiceId }: BookingFlowProps) {
  const flow = useBookingFlow(initialServiceId);

  return (
    <div className="flex flex-col gap-8">
      <Steps current={flow.step} />

      {flow.step === "service" && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="font-heading text-xl font-medium text-foreground">
              Choose a package
            </h2>
            <p className="text-sm text-muted-foreground">
              Tap a package to see the full rate card, then pick a duration to book.
            </p>
          </div>

          {flow.servicesLoading && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-48 animate-pulse rounded-2xl border border-border bg-muted" />
              ))}
            </div>
          )}
          {flow.servicesError && (
            <p className="text-sm text-destructive">{flow.servicesError}</p>
          )}
          {flow.bookingError && (
            <p className="text-sm text-destructive">{flow.bookingError}</p>
          )}

          {!flow.servicesLoading && !flow.servicesError && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {buildPackageCatalog(flow.services).map((pkg) => (
                <PackageCard key={pkg.content.id} pkg={pkg} onSelect={flow.selectService} />
              ))}
            </div>
          )}
        </div>
      )}

      {flow.step === "songs" && flow.selectedService && (
        <StepLayout sidebar={<SelectionSidebar service={flow.selectedService} />}>
          <AddonSongsStep
            service={flow.selectedService}
            bookingSubmitting={flow.bookingSubmitting}
            bookingError={flow.bookingError}
            songStatuses={flow.songStatuses}
            songErrorMessages={flow.songErrorMessages}
            onSubmit={flow.submitAddonSongs}
            onBack={flow.backToService}
          />
        </StepLayout>
      )}

      {flow.step === "date" && flow.selectedService && (
        <StepLayout
          sidebar={<SelectionSidebar service={flow.selectedService} />}
        >
          <div>
            <h2 className="font-heading text-xl font-medium text-foreground">Choose a date</h2>
            <p className="text-sm text-muted-foreground">Only open dates are selectable.</p>
          </div>

          {flow.datesLoading && (
            <p className="text-sm text-muted-foreground">Loading availability…</p>
          )}
          {flow.datesError && <p className="text-sm text-destructive">{flow.datesError}</p>}

          {!flow.datesLoading && !flow.datesError && (
            <div className="flex justify-center rounded-2xl border border-border bg-card p-4 sm:p-6">
              <Calendar
                mode="single"
                className="w-full [--cell-size:--spacing(11)] sm:[--cell-size:--spacing(12)]"
                classNames={{ root: "w-full" }}
                selected={flow.selectedDate ? parseIsoDate(flow.selectedDate) : undefined}
                onSelect={(date) => date && flow.selectDate(toIsoDate(date))}
                disabled={(date) => !flow.openDates.includes(toIsoDate(date))}
              />
            </div>
          )}

          <Button variant="outline" onClick={flow.backToService} className="w-fit">
            Back
          </Button>
        </StepLayout>
      )}

      {flow.step === "window" && flow.selectedService && flow.selectedDate && (
        <StepLayout
          sidebar={<SelectionSidebar service={flow.selectedService} date={flow.selectedDate} />}
        >
          <div>
            <h2 className="font-heading text-xl font-medium text-foreground">
              Choose a time window
            </h2>
            <p className="text-sm text-muted-foreground">Open windows on {flow.selectedDate}.</p>
          </div>

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

          {!flow.windowsLoading && flow.windows.length > 1 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {flow.windows.map((window) => (
                <button
                  key={window.id}
                  type="button"
                  onClick={() => flow.selectWindow(window)}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3.5 text-left transition-colors hover:border-[var(--amber-glow)]/50 hover:bg-secondary"
                >
                  <span className="font-medium">
                    {formatTimeRange(window.start_time, window.end_time)}
                  </span>
                  <Badge>open</Badge>
                </button>
              ))}
            </div>
          )}

          <Button variant="outline" onClick={flow.backToDate} className="w-fit">
            Back
          </Button>
        </StepLayout>
      )}

      {flow.step === "startTime" && flow.selectedService && flow.selectedWindow && (
        <StepLayout
          sidebar={
            <SelectionSidebar
              service={flow.selectedService}
              date={flow.selectedDate}
              window={flow.selectedWindow}
            />
          }
        >
          <div>
            <h2 className="font-heading text-xl font-medium text-foreground">
              Choose a start time
            </h2>
            <p className="text-sm text-muted-foreground">
              Within {formatTimeRange(flow.selectedWindow.start_time, flow.selectedWindow.end_time)}
              , for a {flow.selectedService.duration_hours}-hour session.
            </p>
          </div>

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

          {!flow.startTimesLoading && flow.startTimeOptions.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {flow.startTimeOptions.map((option) => (
                <button
                  key={option.startTime}
                  type="button"
                  disabled={flow.bookingSubmitting}
                  onClick={() => flow.selectStartTime(option)}
                  className="flex flex-col items-center gap-0.5 rounded-xl border border-border bg-card px-3 py-3.5 text-center transition-colors hover:border-[var(--amber-glow)]/50 hover:bg-secondary disabled:pointer-events-none disabled:opacity-50"
                >
                  <span className="font-mono text-sm font-medium">
                    {option.startTime.slice(0, 5)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    – {option.endTime.slice(0, 5)}
                  </span>
                </button>
              ))}
            </div>
          )}

          <Button
            variant="outline"
            onClick={flow.backToWindow}
            disabled={flow.bookingSubmitting}
            className="w-fit"
          >
            Back
          </Button>
        </StepLayout>
      )}

      {flow.step === "summary" && flow.booking && flow.selectedService && (
        <StepLayout
          sidebar={
            <SelectionSidebar
              service={flow.selectedService}
              date={flow.booking.session_date}
              chosenTime={
                flow.booking.session_start_time && flow.booking.session_end_time
                  ? { start: flow.booking.session_start_time, end: flow.booking.session_end_time }
                  : null
              }
              // is_addon booking: total_price_kobo was computed server-side
              // as price_kobo * songCount (0020_addon_song_details.sql), so
              // this division always lands on a whole number.
              songCount={
                flow.selectedService.is_addon
                  ? flow.booking.total_price_kobo / flow.selectedService.price_kobo
                  : undefined
              }
            />
          }
        >
          <BookingSummaryStep
            booking={flow.booking}
            serviceLabel={flow.selectedService.label}
            onCancelled={flow.resetFlow}
          />
        </StepLayout>
      )}
    </div>
  );
}

type SummaryBooking = {
  id: string;
  // Null for an is_addon booking (per-song mixing/mastering) — no studio
  // room time was reserved. See startBookingForService in use-booking-flow.ts.
  session_date: string | null;
  session_start_time: string | null;
  session_end_time: string | null;
  total_price_kobo: number;
  deposit_amount_kobo: number;
};

function BookingSummaryStep({
  booking,
  serviceLabel,
  onCancelled,
}: {
  booking: SummaryBooking;
  serviceLabel: string;
  // Clears the whole flow back to step one. Passed down rather than
  // relying on a route change, because this component is already mounted
  // on /book — see CancelBookingButton's onCancelled prop comment.
  onCancelled: () => void;
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

  // Real bug: closing Paystack's checkout and hitting Back can restore this
  // page from bfcache with paymentSubmitting still frozen "true" — see
  // lib/hooks/use-reset-on-pageshow.ts for the full explanation. Without
  // this, every payment button stays permanently disabled with no way to
  // retry.
  useResetOnPageShow(() => {
    setPaymentSubmitting(null);
    setPaymentError(null);
  });

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
    <Card className="overflow-visible">
      <CardHeader>
        <span className="text-xs font-medium tracking-[0.15em] text-[var(--amber-glow)] uppercase">
          Almost there
        </span>
        <CardTitle className="text-xl">
          {booking.session_date ? `${serviceLabel} — ${booking.session_date}` : serviceLabel}
        </CardTitle>
        <CardDescription>
          {booking.session_start_time && booking.session_end_time
            ? formatTimeRange(booking.session_start_time, booking.session_end_time)
            : "No studio time reserved — this is a per-song add-on, queued once payment is confirmed."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 text-sm">
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-secondary/40 p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total price</span>
            <span className="font-mono font-semibold">{formatKobo(booking.total_price_kobo)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Deposit due (70%)</span>
            <span className="font-mono font-semibold">{formatKobo(booking.deposit_amount_kobo)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <p className="font-medium">Terms &amp; Conditions</p>

          {/* Shortened summary of the real Guidelines & Terms (app/terms/page.tsx) — kept in sync with that page's numbered list, not independent placeholder copy. */}
          <div className="max-h-40 overflow-y-auto rounded-xl border border-border p-3 text-xs text-muted-foreground">
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
              <p className="flex items-center gap-1.5 text-sm text-[var(--moss)]">
                <Check className="size-4" aria-hidden="true" />
                Terms accepted — you can proceed to payment.
              </p>
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
              className="h-11 rounded-none bg-[var(--amber-glow)] text-[var(--primary-foreground)] hover:bg-[var(--amber-dim)] sm:flex-1"
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
              className="h-11 rounded-none sm:flex-1"
            >
              {paymentSubmitting === "full"
                ? "Redirecting…"
                : `Pay in full (${formatKobo(booking.total_price_kobo)})`}
            </Button>
          </div>

          {paymentError && <p className="text-sm text-destructive">{paymentError}</p>}
        </div>

        <div className="border-t border-border pt-4">
          <p className="mb-2 text-xs text-muted-foreground">
            Changed your mind? This booking isn&apos;t confirmed until you pay.
          </p>
          <CancelBookingButton bookingId={booking.id} onCancelled={onCancelled} />
        </div>
      </CardContent>
    </Card>
  );
}

const STEP_ORDER: { key: "service" | "date" | "window" | "startTime" | "summary"; label: string }[] = [
  { key: "service", label: "Package" },
  { key: "date", label: "Date" },
  { key: "startTime", label: "Time" },
  { key: "summary", label: "Confirm" },
];

// "window" collapses into the "Time" step visually — it's often
// auto-skipped (single-window dates), so it doesn't get its own dot. An
// addon booking's "songs" step (contact + track details, replacing
// date/window/startTime entirely) collapses into the "Date" dot — the
// closest equivalent "provide details" step in the visual progression.
function stepIndex(step: BookingStep): number {
  if (step === "window") return 2;
  if (step === "songs") return 1;
  return STEP_ORDER.findIndex((s) => s.key === step);
}

function Steps({ current }: { current: BookingStep }) {
  const currentIndex = stepIndex(current);

  return (
    <div className="flex items-center">
      {STEP_ORDER.map((step, i) => {
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;

        return (
          <div key={step.key} className={`flex items-center ${i < STEP_ORDER.length - 1 ? "flex-1" : ""}`}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex size-7 shrink-0 items-center justify-center rounded-none text-xs font-medium transition-colors ${
                  isDone
                    ? "bg-[var(--amber-glow)] text-[var(--primary-foreground)]"
                    : isCurrent
                      ? "border-2 border-[var(--amber-glow)] text-[var(--amber-glow)]"
                      : "border border-border text-muted-foreground"
                }`}
              >
                {isDone ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
              </div>
              <span
                className={`text-xs font-medium whitespace-nowrap ${
                  isCurrent || isDone ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEP_ORDER.length - 1 && (
              <div
                className={`mx-2 h-px flex-1 transition-colors ${
                  isDone ? "bg-[var(--amber-glow)]" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
