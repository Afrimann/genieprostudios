import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { ServicePackageDetails } from "@/components/services/public-service-catalog";

type ServiceDetailsProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string }>;
};

async function ServiceDetailsContent({ params, searchParams }: ServiceDetailsProps) {
  const [{ slug }, { category }] = await Promise.all([params, searchParams]);
  return <ServicePackageDetails slug={slug} category={category} />;
}

export const metadata: Metadata = {
  title: "Package details | GenieProStudios",
  description: "Explore package rates and inclusions, then book a studio service.",
};

export default function ServiceDetailsPage({
  params,
  searchParams,
}: ServiceDetailsProps) {
  return (
    <main className="flex flex-col">
      <section className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-14">
          <Link
            href="/services"
            className="w-fit text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            All services
          </Link>
          <span className="text-xs font-medium tracking-[0.2em] text-[var(--amber-glow)] uppercase">
            Package details
          </span>
          <h1 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            Rates, inclusions, and booking
          </h1>
        </div>
      </section>
      <section className="mx-auto w-full max-w-5xl px-6">
        <Suspense fallback={<p className="py-16 text-sm text-muted-foreground">Loading package details…</p>}>
          <ServiceDetailsContent params={params} searchParams={searchParams} />
        </Suspense>
      </section>
    </main>
  );
}
