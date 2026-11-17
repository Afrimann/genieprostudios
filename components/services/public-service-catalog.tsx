"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";

import { useServiceCatalog } from "@/lib/hooks/use-service-catalog";
import {
  packageDetailsHref,
  serviceBookingHref,
  findPackageDetails,
} from "@/lib/services/package-details";
import { serviceRateUnitLabel } from "@/lib/services/package-catalog";
import { formatKobo } from "@/lib/utils/money";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import type { Service, ServicePackageFeature } from "@/lib/repositories/service-repository";

const BAR_HEIGHTS = [10, 16, 12, 20, 14];

function ServiceCard({
  service,
  features,
}: {
  service: Service;
  features: ServicePackageFeature[];
}) {
  return (
    <div className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--amber-glow)]/60 hover:shadow-[0_12px_32px_rgba(0,0,0,0.25)]">
      <div className="flex items-end gap-1" aria-hidden="true">
        {BAR_HEIGHTS.map((height, i) => (
          <span
            key={i}
            style={{ height }}
            className="w-1.5 rounded-none bg-[var(--amber-glow)]/70 transition-all duration-300 group-hover:bg-[var(--amber-glow)]"
          />
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-lg font-medium text-foreground">{service.label}</h3>
        <p className="text-sm text-muted-foreground">
          {service.is_addon
            ? `Priced ${serviceRateUnitLabel(service)} · no studio time needed`
            : `${serviceRateUnitLabel(service)} session`}
        </p>
      </div>
      <p className="font-heading text-2xl font-medium text-foreground">
        {formatKobo(service.price_kobo)}
        {service.is_addon && <span className="ml-1 text-sm font-normal text-muted-foreground">
          /{service.category === "digital_production" ? "track" : "song"}
        </span>}
      </p>
      {features.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-t border-border pt-4">
          {features.map((feature) => (
            <li key={feature.label} className="flex items-start gap-2 text-xs text-muted-foreground">
              {feature.included
                ? <Check className="mt-0.5 size-3.5 shrink-0 text-[var(--amber-glow)]" aria-hidden="true" />
                : <X className="mt-0.5 size-3.5 shrink-0 text-red-500" aria-hidden="true" />}
              {feature.label}
            </li>
          ))}
        </ul>
      )}
      <Button
        asChild
        className="mt-auto w-full rounded-none bg-[var(--amber-glow)] text-[var(--primary-foreground)] hover:bg-[var(--amber-dim)]"
      >
        <Link href={serviceBookingHref(service.id)}>Book this</Link>
      </Button>
    </div>
  );
}

export function PublicServiceCatalog() {
  const { catalog, loading, error } = useServiceCatalog();
  const categories = catalog.packages.flatMap((pkg) =>
    pkg.categories
      .filter((category) => category.active && category.services.some((service) => service.active))
      .map((category) => ({ ...category, pkg })),
  );
  const packages = new Map<string, { title: string; category: string }>();
  for (const entry of categories) {
    if (!packages.has(entry.pkg.id)) {
      packages.set(entry.pkg.id, {
        title: entry.pkg.title,
        category: entry.category,
      });
    }
  }

  if (loading) {
    return <div className="flex flex-col gap-4 px-6 py-16" role="status">Loading services…</div>;
  }
  if (error) {
    return <p className="px-6 py-16 text-sm text-muted-foreground" role="alert">{error}</p>;
  }
  if (categories.length === 0) {
    return <p className="px-6 py-16 text-sm text-muted-foreground">No services are available right now — please check back soon.</p>;
  }

  return (
    <div className="flex min-w-0 flex-col">
      <nav aria-label="Browse service packages" className="border-y border-border bg-card">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-6">
          <p className="text-xs font-medium tracking-[0.18em] text-[var(--amber-glow)] uppercase">
            Browse packages
          </p>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...packages.entries()].map(([packageId, item]) => (
              <a
                key={packageId}
                href={`#${item.category}`}
                className="flex min-h-14 min-w-0 items-center justify-between border border-[var(--amber-glow)]/40 bg-background px-5 py-4 font-heading text-base font-medium text-foreground transition-colors hover:border-[var(--amber-glow)] hover:bg-[var(--amber-glow)] hover:text-[var(--primary-foreground)]"
              >
                <span className="break-words">{item.title}</span>
                <span aria-hidden="true" className="ml-3 shrink-0 text-lg">
                  →
                </span>
              </a>
            ))}
          </div>
        </div>
      </nav>
      {categories.map((category, i) => {
        // The legacy post-production package's feature metadata describes an
        // unrelated production add-on. The category's own description is the
        // approved source for the renamed mixing/mastering offer.
        const features = category.pkg.slug === "post-production-addon"
          ? []
          : category.pkg.features;
        return (
          <section
            key={category.category}
            id={category.category}
            className={`scroll-mt-16 border-b border-border ${i % 2 === 0 ? "bg-background" : "bg-card"}`}
          >
            <Reveal className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-16">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <h2 className="font-heading text-2xl font-medium tracking-tight text-foreground">
                    {category.label}
                  </h2>
                  {category.description && <p className="max-w-2xl text-sm text-muted-foreground">{category.description}</p>}
                </div>
                <Button asChild variant="outline" className="rounded-none">
                  <Link href={packageDetailsHref(category.pkg.slug, category.category)}>Learn more</Link>
                </Button>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {category.services.filter((service) => service.active).map((service) => (
                  <ServiceCard key={service.id} service={service} features={features} />
                ))}
              </div>
            </Reveal>
          </section>
        );
      })}
    </div>
  );
}

export function ServicePackageDetails({
  slug,
  category: categoryKey,
}: {
  slug: string;
  category?: string;
}) {
  const { catalog, loading, error } = useServiceCatalog();
  if (loading) return <p className="py-16 text-sm text-muted-foreground" role="status">Loading package details…</p>;
  if (error) return <p className="py-16 text-sm text-muted-foreground" role="alert">{error}</p>;

  const details = findPackageDetails(catalog, slug, categoryKey);
  if (!details) {
    return (
      <div className="flex flex-col items-start gap-4 py-16">
        <p className="text-muted-foreground">This package or category is not available.</p>
        <Button asChild variant="outline"><Link href="/services">Browse all services</Link></Button>
      </div>
    );
  }

  const { pkg, category, categories } = details;
  const features = pkg.slug === "post-production-addon" ? [] : pkg.features;

  return (
    <div className="flex flex-col gap-10 py-12">
      <div className="flex flex-wrap gap-2" aria-label="Package categories">
        {categories.map((item) => (
          <Button
            key={item.category}
            asChild
            variant={item.category === category.category ? "default" : "outline"}
            className="rounded-none"
          >
            <Link href={packageDetailsHref(pkg.slug, item.category)}>{item.label}</Link>
          </Button>
        ))}
      </div>
      <section className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-[var(--amber-glow)] uppercase">{pkg.title}</p>
          <h2 className="mt-2 font-heading text-3xl font-medium text-foreground">{category.label}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {category.services.filter((service) => service.active).map((service) => (
            <div key={service.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
              <h3 className="font-medium text-foreground">{service.label}</h3>
              <p className="text-sm text-muted-foreground">
                {service.is_addon
                  ? serviceRateUnitLabel(service)
                  : `${serviceRateUnitLabel(service)} session`}
              </p>
              <p className="font-heading text-2xl text-foreground">
                {formatKobo(service.price_kobo)}
                {service.is_addon && <span className="ml-1 text-sm font-normal text-muted-foreground">
                  /{service.category === "digital_production" ? "track" : "song"}
                </span>}
              </p>
              <Button asChild className="mt-auto rounded-none bg-[var(--amber-glow)] text-[var(--primary-foreground)] hover:bg-[var(--amber-dim)]">
                <Link href={serviceBookingHref(service.id)}>Book this option</Link>
              </Button>
            </div>
          ))}
        </div>
      </section>
      {(category.description || features.length > 0) && (
        <section className="flex flex-col gap-4 border-t border-border pt-8">
          <h3 className="font-heading text-xl font-medium text-foreground">
            {features.length > 0 ? "Package inclusions & details" : "Service details"}
          </h3>
          {category.description && <p className="text-sm text-muted-foreground">{category.description}</p>}
          {features.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {features.map((feature) => (
                <li key={feature.id} className="flex items-start gap-2 text-sm text-muted-foreground">
                  {feature.included
                    ? <Check className="mt-0.5 size-4 shrink-0 text-[var(--amber-glow)]" aria-hidden="true" />
                    : <X className="mt-0.5 size-4 shrink-0 text-red-500" aria-hidden="true" />}
                  {feature.label}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
