"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";

import { Reveal } from "@/components/ui/reveal";
import { CountUp } from "@/components/home/count-up";
import type { TriumphPackage } from "@/lib/repositories/triumph-package-repository";
import { BrandGlow } from "@/components/triumph/brand-glow";
import type { TriumphExchangeRates } from "@/lib/services/exchange-rates";

const CURRENCIES = [
  { code: "NGN", label: "NGN ₦", locale: "en-NG" },
  { code: "USD", label: "USD $", locale: "en-US" },
  { code: "GBP", label: "GBP £", locale: "en-GB" },
] as const;

type DisplayCurrency = (typeof CURRENCIES)[number]["code"];

const CURRENCY_LOCALES: Record<DisplayCurrency, string> = {
  NGN: "en-NG",
  USD: "en-US",
  GBP: "en-GB",
};

// Per-card mini VU-bar graphic — same mechanism as
// components/home/services-teaser.tsx's rack-unit bars, animated in on
// scroll rather than static.
const BAR_SETS = [
  [40, 65, 50, 80, 55],
  [55, 80, 45, 60, 70],
  [70, 50, 85, 60, 45],
  [45, 75, 55, 90, 65],
  [60, 40, 70, 50, 80],
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 24, scale: 0.94 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 240, damping: 22 },
  },
};

// Tiers are now owner-managed via /triumph-admin/packages
// (triumph_packages table, 0041_triumph_packages.sql) instead of the old
// static TRIUMPH_PRICING_TIERS array — the page server-fetches them and
// passes them in here, since this component stays a Client Component for
// its scroll-triggered animations.
export function TriumphPricing({
  tiers,
  rates,
}: {
  tiers: TriumphPackage[];
  rates: TriumphExchangeRates | null;
}) {
  const [currency, setCurrency] = useState<DisplayCurrency>("NGN");
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(CURRENCY_LOCALES[currency], {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }),
    [currency],
  );
  const roundingIncrement = currency === "NGN" ? 1_000 : 1;
  const formatPrice = useMemo(
    () => (value: number) =>
      numberFormatter.format(Math.ceil(value / roundingIncrement) * roundingIncrement),
    [numberFormatter, roundingIncrement],
  );

  if (tiers.length === 0) return null;

  return (
    <section id="pricing" className="relative scroll-mt-16 overflow-hidden border-b border-border bg-card">
      <BrandGlow variant="center" />
      <Reveal className="relative z-[1] mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-24">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium tracking-[0.2em] text-[#22e6c8] uppercase">
            Transparent pricing
          </span>
          <h2 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            Every service, priced up front.
          </h2>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Display prices in"
          >
            {CURRENCIES.map((item) => {
              const unavailable = item.code !== "USD" && !rates;

              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => setCurrency(item.code)}
                  disabled={unavailable}
                  aria-pressed={currency === item.code}
                  className={`border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    currency === item.code
                      ? "border-[#22e6c8] bg-[#22e6c8]/10 text-[#22e6c8]"
                      : "border-border text-muted-foreground hover:border-[#22e6c8]/60 hover:text-foreground"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          {rates ? (
            <p className="text-xs text-muted-foreground">
              Converted prices are estimates only; invoices and payments remain in USD. Rates
              updated {rates.updatedAt}.{" "}
              <a
                href="https://www.exchangerate-api.com"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Rates by ExchangeRate-API
              </a>
              .
            </p>
          ) : (
            <p className="text-sm text-amber-500" role="status">
              Live NGN and GBP rates are unavailable right now. USD prices remain available.
            </p>
          )}
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px 0px" }}
          className="grid grid-cols-1 gap-6 py-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {tiers.map((tier, i) => {
            const convertedPrice = currency === "USD"
              ? tier.price_usd
              : rates
                ? tier.price_usd * rates.rates[currency]
                : undefined;

            return (
              <motion.div
                key={tier.id}
                variants={item}
                whileHover={{ scale: 1.02, zIndex: 10 }}
                className={`flex flex-col gap-3 border p-5 shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-shadow duration-300 hover:shadow-[0_16px_36px_rgba(0,0,0,0.4)] ${
                  tier.featured
                    ? "border-[#22e6c8] bg-[#22e6c8]/10"
                    : "border-border bg-background"
                }`}
              >
                {tier.featured && (
                  <span
                    className="animate-opacity-pulse w-fit bg-[#22e6c8] px-2 py-0.5 text-[10px] font-medium tracking-wide text-[#04211c] uppercase"
                    style={{ animationDuration: "1.8s" }}
                  >
                    Most popular
                  </span>
                )}

                <div className="flex items-end gap-1" aria-hidden="true">
                  {BAR_SETS[i % BAR_SETS.length].map((height, j) => (
                    <motion.span
                      key={j}
                      initial={{ height: 0 }}
                      whileInView={{ height }}
                      viewport={{ once: true, margin: "-80px 0px" }}
                      transition={{ duration: 0.7, delay: j * 0.06, ease: "easeOut" }}
                      style={{ maxHeight: height }}
                      className="w-1.5 rounded-none bg-[#22e6c8]/70"
                    />
                  ))}
                </div>

                <h3 className="font-heading text-lg font-medium text-foreground">{tier.name}</h3>
                <p className="font-heading text-2xl font-medium text-foreground">
                  {convertedPrice !== undefined ? (
                    <CountUp
                      to={convertedPrice}
                      durationSeconds={1.2}
                      formatValue={formatPrice}
                    />
                  ) : (
                    <span>Unavailable</span>
                  )}
                  <span className="text-sm font-normal text-muted-foreground">{tier.unit}</span>
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">{tier.description}</p>
                <p className="mt-auto font-mono text-xs text-muted-foreground">{tier.turnaround}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </Reveal>
    </section>
  );
}
