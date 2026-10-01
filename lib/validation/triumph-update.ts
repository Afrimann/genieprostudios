import { z } from "zod";

// Mirrors public.triumph_project_status (0023_triumph_projects.sql).
export const TRIUMPH_PROJECT_STATUSES = [
  "new",
  "in_progress",
  "review",
  "completed",
  "cancelled",
] as const;

export type TriumphProjectStatus = (typeof TRIUMPH_PROJECT_STATUSES)[number];

// Shared display labels — used by both the admin update form/status
// dropdown and the client-facing tracking timeline, so the two sides never
// drift into different wording for the same status.
export const TRIUMPH_PROJECT_STATUS_LABELS: Record<TriumphProjectStatus, string> = {
  new: "New",
  in_progress: "In Progress",
  review: "In Review",
  completed: "Completed",
  cancelled: "Cancelled",
};

// Server Action boundary schema for an admin posting a project update — a
// status change and/or a note and/or a deliverable, all the same
// underlying primitive (see create_triumph_project_update RPC). filePath/
// fileName are only set after a successful direct-to-storage upload
// (lib/hooks/use-triumph-admin-update.ts) — this schema doesn't validate
// the file itself, only that both are present together or neither is.
//
// body is deliberately optional (2026-10-xx): the admin must be able to
// mark a project "Completed" (or any other status) as a pure status
// change, with no note and no deliverable attached — e.g. the client
// already has their files, or payment/scope simply concluded. The only
// hard rule is that an update can't be completely empty: at least one of
// body/statusAfter/filePath must carry something.
export const triumphProjectUpdateSchema = z
  .object({
    projectId: z.string().uuid(),
    body: z.string().trim(),
    statusAfter: z.enum(TRIUMPH_PROJECT_STATUSES).nullable(),
    filePath: z.string().trim().min(1).nullable(),
    fileName: z.string().trim().min(1).nullable(),
  })
  .refine((value) => (value.filePath === null) === (value.fileName === null), {
    message: "filePath and fileName must both be set or both be null",
  })
  .refine((value) => value.body.length > 0 || value.statusAfter !== null || value.filePath !== null, {
    message: "Add a note, change the status, or attach a file.",
  });

export type TriumphProjectUpdateInput = z.infer<typeof triumphProjectUpdateSchema>;
