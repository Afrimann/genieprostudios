import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";

import {
  verifyTrackingCookie,
  trackingCookieName,
  verifiedCookieName,
} from "@/lib/services/triumph-tracking-cookie";
import {
  getTriumphProjectById,
  getTriumphProjectUpdates,
} from "@/lib/repositories/triumph-projects-repository";
import { TRIUMPH_PRICING_TIERS } from "@/lib/data/triumph-pricing";
import { ProjectStatusTimeline } from "@/components/triumph/project-status-timeline";
import { TrackLookupForm } from "@/components/triumph/track-lookup-form";
import { Reveal } from "@/components/ui/reveal";
import { BrandGlow } from "@/components/triumph/brand-glow";

export const metadata: Metadata = {
  title: { absolute: "Project Status — Triumph Music Global" },
  robots: { index: false, follow: false },
};

// Always needs a live cookie check against this request's cookies() — can
// never be meaningfully prerendered, same reasoning as app/admin/(protected)/layout.tsx.
export const instant = false;

function LookupFallback() {
  return (
    <section className="bg-grain relative overflow-hidden border-b border-border bg-card">
      <BrandGlow variant="center" />
      <Reveal className="relative z-[1] mx-auto flex w-full max-w-md flex-col gap-8 px-6 py-24">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-xs font-medium tracking-[0.2em] text-[#22e6c8] uppercase">
            Find your project
          </span>
          <h1 className="font-heading text-3xl font-medium tracking-tight text-foreground">
            Check your project status
          </h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            We couldn&apos;t verify your session. Enter your project code and email to continue.
          </p>
        </div>
        <TrackLookupForm />
      </Reveal>
    </section>
  );
}

export default async function TriumphTrackCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  // Forces this render to be treated as genuinely dynamic from this point
  // on — without it, Cache Components' prerendering pass for this
  // unenumerated [code] segment flags verifyTrackingCookie()'s Date.now()
  // call as an "unstable value," even though cookies() below is already
  // request-scoped. instant = false alone isn't enough for this specific
  // diagnostic (see its own suggested fixes), hence this explicit marker.
  await connection();

  const { code } = await params;
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(trackingCookieName(code))?.value;
  const projectId = verifyTrackingCookie(cookieValue);

  if (!projectId) {
    return <LookupFallback />;
  }

  const project = await getTriumphProjectById(projectId);

  // Defense-in-depth: a cookie validly signed for a different project must
  // never grant access just because the URL's [code] segment changed —
  // see triumph-tracking-cookie.ts's comment on why the payload holds the
  // project's UUID rather than trusting the URL alone.
  if (!project || project.project_code !== code) {
    return <LookupFallback />;
  }

  const verifiedCookieValue = cookieStore.get(verifiedCookieName(code))?.value;
  const verifiedProjectId = verifyTrackingCookie(verifiedCookieValue);
  const isVerified = verifiedProjectId === project.id;

  const updates = await getTriumphProjectUpdates(project.id);
  const serviceLabel =
    TRIUMPH_PRICING_TIERS.find((tier) => tier.id === project.service_id)?.name ?? project.service_id;

  return (
    <section className="bg-grain relative overflow-hidden border-b border-border bg-card">
      <BrandGlow />
      <Reveal className="relative z-[1] mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-24">
        <div className="flex flex-col gap-1 border-b border-border pb-6">
          <span className="text-xs font-medium tracking-[0.2em] text-[#22e6c8] uppercase">
            {project.project_code}
          </span>
          <h1 className="font-heading text-2xl font-medium text-foreground sm:text-3xl">{serviceLabel}</h1>
          <p className="text-xs text-muted-foreground">
            Submitted {new Date(project.created_at).toLocaleDateString()}
          </p>
        </div>

        <ProjectStatusTimeline
          projectCode={project.project_code}
          initialStatus={project.status}
          initialPaymentStatus={project.payment_status}
          initialVerified={isVerified}
          initialUpdates={updates.map((u) => ({
            id: u.id,
            body: u.body,
            statusAfter: u.status_after,
            fileName: u.file_name,
            createdAt: u.created_at,
          }))}
        />
      </Reveal>
    </section>
  );
}
