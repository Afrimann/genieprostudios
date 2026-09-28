"use client";

import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";

import type { Service } from "@/lib/repositories/service-repository";
import type { SongUploadStatus } from "@/lib/hooks/use-booking-flow";
import {
  addonSongsFormSchema,
  MAX_FILE_SIZE_LABEL,
  type AddonSongsFormValues,
} from "@/lib/validation/addon-songs";
import { formatKobo } from "@/lib/utils/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STATUS_LABEL: Record<SongUploadStatus, string> = {
  idle: "",
  uploading: "Uploading…",
  saving: "Saving…",
  done: "Uploaded",
  error: "Failed",
};

interface AddonSongsStepProps {
  service: Service;
  bookingSubmitting: boolean;
  bookingError: string | null;
  songStatuses: SongUploadStatus[];
  songErrorMessages: (string | null)[];
  onSubmit: (
    contactName: string,
    contactEmail: string,
    songs: { title: string; file: File }[],
  ) => void;
  onBack: () => void;
}

/**
 * The "songs" step for an is_addon service (per-song mixing/mastering) —
 * collects contact info once, then a repeatable title + WAV file per song.
 * Local form state only (same convention as BookingSummaryStep's consent
 * form): submission and upload progress live in useBookingFlow, this
 * component just renders {songStatuses, songErrorMessages} and calls
 * onSubmit with the full form values every time (including retries — the
 * hook itself skips songs already marked "done").
 */
export function AddonSongsStep({
  service,
  bookingSubmitting,
  bookingError,
  songStatuses,
  songErrorMessages,
  onSubmit,
  onBack,
}: AddonSongsStepProps) {
  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AddonSongsFormValues>({
    resolver: zodResolver(addonSongsFormSchema),
    defaultValues: {
      contactName: "",
      contactEmail: "",
      songs: [{ title: "", file: undefined as unknown as File }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "songs" });
  const songs = watch("songs");
  const songCount = songs?.length ?? 0;
  const totalKobo = service.price_kobo * songCount;

  // Once a booking has been created for this order (first submit attempt),
  // the song count is locked in — the price was already fixed at that
  // count, so songs can no longer be added or removed. Individual songs
  // that haven't uploaded yet can still be edited before retrying.
  const submissionStarted = songStatuses.length > 0;

  function onValid(values: AddonSongsFormValues) {
    onSubmit(values.contactName, values.contactEmail, values.songs);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-heading text-xl font-medium text-foreground">
          Tell us about your songs
        </h2>
        <p className="text-sm text-muted-foreground">
          {service.label} is priced per song — add a title and the WAV file for each track.
        </p>
      </div>

      <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-medium text-foreground">Your contact details</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contactName">Full name</Label>
              <Input
                id="contactName"
                disabled={submissionStarted}
                aria-invalid={!!errors.contactName}
                {...register("contactName")}
              />
              {errors.contactName && (
                <p className="text-sm text-destructive">{errors.contactName.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contactEmail">Email</Label>
              <Input
                id="contactEmail"
                type="email"
                disabled={submissionStarted}
                aria-invalid={!!errors.contactEmail}
                {...register("contactEmail")}
              />
              {errors.contactEmail && (
                <p className="text-sm text-destructive">{errors.contactEmail.message}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Songs</p>
            <span className="font-mono text-xs text-muted-foreground">
              {songCount} song{songCount === 1 ? "" : "s"} · {formatKobo(totalKobo)}
            </span>
          </div>

          {fields.map((field, index) => {
            const status = songStatuses[index];
            const statusError = songErrorMessages[index];
            const fieldLocked = status === "done" || status === "uploading" || status === "saving";

            return (
              <div
                key={field.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium tracking-[0.1em] text-muted-foreground uppercase">
                    Song {index + 1}
                  </span>
                  {fields.length > 1 && !submissionStarted && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      className="h-7 px-2 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`songs.${index}.title`}>Track title</Label>
                    <Input
                      id={`songs.${index}.title`}
                      disabled={fieldLocked}
                      aria-invalid={!!errors.songs?.[index]?.title}
                      {...register(`songs.${index}.title` as const)}
                    />
                    {errors.songs?.[index]?.title && (
                      <p className="text-sm text-destructive">
                        {errors.songs[index]?.title?.message}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`songs.${index}.file`}>
                      WAV file{" "}
                      <span className="font-normal text-muted-foreground">
                        (max {MAX_FILE_SIZE_LABEL})
                      </span>
                    </Label>
                    <Controller
                      control={control}
                      name={`songs.${index}.file`}
                      render={({ field: fileField }) => (
                        <Input
                          id={`songs.${index}.file`}
                          type="file"
                          accept=".wav,audio/wav,audio/x-wav,audio/wave"
                          disabled={fieldLocked}
                          onChange={(e) => fileField.onChange(e.target.files?.[0])}
                        />
                      )}
                    />
                    {errors.songs?.[index]?.file && (
                      <p className="text-sm text-destructive">
                        {errors.songs[index]?.file?.message}
                      </p>
                    )}
                  </div>
                </div>

                {status && status !== "idle" && (
                  <p
                    className={`flex items-center gap-1.5 text-xs ${
                      status === "error"
                        ? "text-destructive"
                        : status === "done"
                          ? "text-[var(--moss)]"
                          : "text-muted-foreground"
                    }`}
                  >
                    {status === "done" && <Check className="size-3.5" aria-hidden="true" />}
                    {(status === "uploading" || status === "saving") && (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    )}
                    {statusError ?? STATUS_LABEL[status]}
                  </p>
                )}
              </div>
            );
          })}

          {!submissionStarted && (
            <Button
              type="button"
              variant="outline"
              onClick={() => append({ title: "", file: undefined as unknown as File })}
              className="w-fit"
            >
              <Plus className="size-4" aria-hidden="true" />
              Add another song
            </Button>
          )}
        </div>

        {bookingError && <p className="text-sm text-destructive">{bookingError}</p>}

        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            disabled={bookingSubmitting}
            className="h-11 rounded-none bg-[var(--amber-glow)] px-6 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--amber-dim)]"
          >
            {bookingSubmitting
              ? "Submitting…"
              : submissionStarted
                ? "Retry"
                : "Continue to payment"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={bookingSubmitting}
            className="h-11 rounded-none px-6 text-sm font-medium"
          >
            Back
          </Button>
        </div>
      </form>
    </div>
  );
}
