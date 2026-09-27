"use client";

import { useState } from "react";
import { Check, Minus, ChevronRight } from "lucide-react";

import type { Service } from "@/lib/repositories/service-repository";
import type { PricedPackage } from "@/lib/services/package-catalog";
import { formatKobo } from "@/lib/utils/money";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

function durationLabel(service: Service): string {
  return service.is_addon
    ? "Per song"
    : `${service.duration_hours} hour${service.duration_hours === 1 ? "" : "s"}`;
}

function RateRow({
  service,
  onSelect,
}: {
  service: Service;
  onSelect: (service: Service) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(service)}
      className="group/rate flex w-full items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-left transition-colors hover:border-[var(--amber-glow)]/50 hover:bg-secondary"
    >
      <span className="text-sm font-medium text-foreground">{durationLabel(service)}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
          {formatKobo(service.price_kobo)}
        </span>
        <ChevronRight
          className="size-4 text-muted-foreground transition-transform group-hover/rate:translate-x-0.5 group-hover/rate:text-[var(--amber-glow)]"
          aria-hidden="true"
        />
      </span>
    </button>
  );
}

function RateColumn({
  label,
  services,
  onSelect,
}: {
  label: string;
  services: Service[];
  onSelect: (service: Service) => void;
}) {
  if (services.length === 0) return null;

  return (
    <div className="flex flex-1 flex-col gap-2">
      <span className="text-xs font-medium tracking-[0.15em] text-[var(--amber-glow)] uppercase">
        {label}
      </span>
      <div className="flex flex-col gap-2">
        {services.map((service) => (
          <RateRow key={service.id} service={service} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

interface PackageCardProps {
  pkg: PricedPackage;
  onSelect: (service: Service) => void;
}

export function PackageCard({ pkg, onSelect }: PackageCardProps) {
  const [open, setOpen] = useState(false);
  const { content, dayRows, nightRows, singleRows, minPriceKobo } = pkg;

  const includedPreview = content.features.filter((f) => f.included).slice(0, 2);

  function handleSelect(service: Service) {
    setOpen(false);
    onSelect(service);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group/card flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--amber-glow)]/40 hover:shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
      >
        <div className="flex flex-col gap-1">
          <h3 className="font-heading text-lg font-medium text-foreground">{content.title}</h3>
          {content.subtitle && (
            <p className="text-sm text-muted-foreground">{content.subtitle}</p>
          )}
        </div>

        {includedPreview.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {includedPreview.map((feature) => (
              <li key={feature.label} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Check className="size-3.5 shrink-0 text-[var(--amber-glow)]" aria-hidden="true" />
                {feature.label}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
          <div className="flex flex-col">
            <span className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">
              From
            </span>
            <span className="font-mono text-lg font-semibold text-foreground">
              {formatKobo(minPriceKobo)}
            </span>
          </div>
          <span className="flex items-center gap-1 text-sm font-medium text-[var(--amber-glow)]">
            View details
            <ChevronRight
              className="size-4 transition-transform group-hover/card:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg gap-5 overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{content.title}</DialogTitle>
            {content.subtitle && <DialogDescription>{content.subtitle}</DialogDescription>}
          </DialogHeader>

          {(dayRows.length > 0 || nightRows.length > 0) && (
            <div className="flex flex-col gap-4 sm:flex-row">
              <RateColumn label="Day" services={dayRows} onSelect={handleSelect} />
              <RateColumn label="Night" services={nightRows} onSelect={handleSelect} />
            </div>
          )}

          {singleRows.length > 0 && (
            <div className="flex flex-col gap-2">
              {singleRows.map((service) => (
                <RateRow key={service.id} service={service} onSelect={handleSelect} />
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            {content.features.map((feature) => (
              <div
                key={feature.label}
                className={`flex items-start gap-2.5 text-sm ${
                  feature.included ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {feature.included ? (
                  <Check
                    className={`mt-0.5 size-4 shrink-0 ${
                      feature.highlight ? "text-[var(--amber-glow)]" : "text-emerald-500"
                    }`}
                    aria-hidden="true"
                  />
                ) : (
                  <Minus className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                )}
                <span className={feature.highlight ? "font-medium" : ""}>{feature.label}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
