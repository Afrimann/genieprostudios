import { notFound } from "next/navigation";

import {
  getTriumphProjectForAdmin,
  getTriumphProjectUpdatesForAdmin,
} from "@/lib/repositories/triumph-admin-repository";
import { TRIUMPH_PRICING_TIERS } from "@/lib/data/triumph-pricing";
import { TRIUMPH_PROJECT_STATUS_LABELS, type TriumphProjectStatus } from "@/lib/validation/triumph-update";
import { ProjectUpdateForm } from "@/components/triumph-admin/project-update-form";
import { PaymentStatusToggle } from "@/components/triumph-admin/payment-status-toggle";
import { RealtimeRefresher } from "@/components/admin/realtime-refresher";

// Behind app/triumph-admin/(protected)/layout.tsx's live session+admin
// check — can never be meaningfully prerendered, same reasoning as every
// admin page under app/admin/(protected)/*.
export const instant = false;

// Same restrained dot convention as the dashboard list — the only color
// doing real information work on this page.
const STATUS_DOT_CLASS: Record<TriumphProjectStatus, string> = {
  new: "bg-muted-foreground/50",
  in_progress: "bg-[#22e6c8]",
  review: "bg-[#22e6c8]",
  completed: "bg-[#22e6c8]",
  cancelled: "bg-destructive/70",
};

export default async function TriumphAdminProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const project = await getTriumphProjectForAdmin(id);

  if (!project) {
    notFound();
  }

  const updates = await getTriumphProjectUpdatesForAdmin(id);
  const serviceLabel =
    TRIUMPH_PRICING_TIERS.find((tier) => tier.id === project.service_id)?.name ?? project.service_id;

  return (
    <div className="flex flex-col gap-8 p-6 sm:p-8">
      <RealtimeRefresher
        channelName={`triumph-admin-project-${id}`}
        tables={[
          { table: "triumph_projects", filter: `id=eq.${id}` },
          { table: "triumph_project_updates", filter: `project_id=eq.${id}` },
        ]}
      />
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-xs text-muted-foreground">{project.project_code}</span>
        <h1 className="font-heading text-xl font-medium text-foreground">{project.full_name}</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {serviceLabel} · {project.number_of_songs} song{project.number_of_songs === 1 ? "" : "s"}
          </span>
          <span className="text-border">·</span>
          <span className="flex items-center gap-1.5">
            <span className={`size-1.5 rounded-full ${STATUS_DOT_CLASS[project.status]}`} aria-hidden="true" />
            {TRIUMPH_PROJECT_STATUS_LABELS[project.status]}
          </span>
        </div>
      </div>

      <PaymentStatusToggle projectId={project.id} currentStatus={project.payment_status} />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-5 border border-border p-6 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <dt className="text-xs text-muted-foreground">Email</dt>
          <dd className="text-sm text-foreground">{project.email}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs text-muted-foreground">Phone</dt>
          <dd className="text-sm text-foreground">{project.phone}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs text-muted-foreground">Country</dt>
          <dd className="text-sm text-foreground">{project.country}</dd>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <dt className="text-xs text-muted-foreground">Project details</dt>
          <dd className="text-sm text-foreground">{project.project_details}</dd>
        </div>
      </dl>

      <ProjectUpdateForm
        projectId={project.id}
        currentStatus={project.status}
        hasDeliverable={updates.some((update) => update.file_name !== null)}
      />

      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-foreground">Timeline</h2>
        {updates.length === 0 ? (
          <p className="border border-border p-4 text-sm text-muted-foreground">No updates posted yet.</p>
        ) : (
          <ol className="relative flex flex-col gap-5">
            <div className="absolute top-1 bottom-1 left-[3px] w-px bg-border" aria-hidden="true" />
            {updates
              .slice()
              .reverse()
              .map((update) => (
                <li key={update.id} className="relative flex gap-4 pl-7">
                  <span className="absolute top-1.5 left-0 size-[7px] rounded-full bg-[#22e6c8]" aria-hidden="true" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{new Date(update.created_at).toLocaleString()}</span>
                      {update.status_after && (
                        <>
                          <span className="text-border">·</span>
                          <span className="font-medium text-foreground">
                            {TRIUMPH_PROJECT_STATUS_LABELS[update.status_after]}
                          </span>
                        </>
                      )}
                    </div>
                    {update.body && <p className="mt-1.5 text-sm text-foreground">{update.body}</p>}
                    {update.file_name && (
                      <p className="mt-1.5 text-xs text-muted-foreground">Attached: {update.file_name}</p>
                    )}
                  </div>
                </li>
              ))}
          </ol>
        )}
      </div>
    </div>
  );
}
