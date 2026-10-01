import Link from "next/link";
import { ChevronRight } from "lucide-react";

import {
  listTriumphProjectsForAdmin,
  getTriumphProjectStatusCounts,
} from "@/lib/repositories/triumph-admin-repository";
import { TRIUMPH_PRICING_TIERS } from "@/lib/data/triumph-pricing";
import { TRIUMPH_PROJECT_STATUS_LABELS, type TriumphProjectStatus } from "@/lib/validation/triumph-update";
import { TRIUMPH_PAYMENT_STATUS_LABELS } from "@/lib/validation/triumph-payment";

// Behind app/triumph-admin/(protected)/layout.tsx's live session+admin
// check — can never be meaningfully prerendered, same reasoning as every
// admin page under app/admin/(protected)/*.
export const instant = false;

// A small colored dot carries the status at a glance instead of a boxed
// icon per row — teal reads as "in motion/live," muted gray as "not
// started," destructive as "cancelled." Deliberately restrained: this is
// the only place color does real information work on this page.
const STATUS_DOT_CLASS: Record<TriumphProjectStatus, string> = {
  new: "bg-muted-foreground/50",
  in_progress: "bg-[#22e6c8]",
  review: "bg-[#22e6c8]",
  completed: "bg-[#22e6c8]",
  cancelled: "bg-destructive/70",
};

export default async function TriumphAdminDashboardPage() {
  const [projects, counts] = await Promise.all([
    listTriumphProjectsForAdmin(),
    getTriumphProjectStatusCounts(),
  ]);

  // Default view: newest-first, active projects only — completed/cancelled
  // projects don't need the engineer's attention day-to-day.
  const activeProjects = projects.filter(
    (project) => project.status !== "completed" && project.status !== "cancelled",
  );

  return (
    <div className="flex flex-col gap-8 p-6 sm:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-medium text-foreground">Projects</h1>
        <p className="text-sm text-muted-foreground">
          Triumph Music Global — incoming requests &amp; work in progress.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-5">
        {(Object.keys(counts) as TriumphProjectStatus[]).map((status) => (
          <div key={status} className="flex flex-col gap-1 bg-card p-4">
            <span className="font-heading text-2xl font-medium text-foreground">{counts[status]}</span>
            <span className="text-xs text-muted-foreground">{TRIUMPH_PROJECT_STATUS_LABELS[status]}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col border border-border">
        {activeProjects.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No active projects right now.</p>
        ) : (
          activeProjects.map((project) => {
            const serviceLabel =
              TRIUMPH_PRICING_TIERS.find((tier) => tier.id === project.service_id)?.name ?? project.service_id;

            return (
              <Link
                key={project.id}
                href={`/triumph-admin/projects/${project.id}`}
                className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-b-0 hover:bg-secondary"
              >
                <span className={`size-2 shrink-0 rounded-full ${STATUS_DOT_CLASS[project.status]}`} aria-hidden="true" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium text-foreground">{project.full_name}</span>
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {project.project_code} — {serviceLabel}
                  </span>
                </div>
                <div className="hidden shrink-0 items-center gap-4 text-xs text-muted-foreground sm:flex">
                  <span>{TRIUMPH_PROJECT_STATUS_LABELS[project.status]}</span>
                  <span>{TRIUMPH_PAYMENT_STATUS_LABELS[project.payment_status]}</span>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
