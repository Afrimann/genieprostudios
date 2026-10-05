"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, UserPlus } from "lucide-react";

import type { FrontdeskStaffMember } from "@/lib/repositories/frontdesk-staff-repository";
import {
  inviteFrontdeskStaffAction,
  revokeFrontdeskStaffAction,
} from "@/lib/services/frontdesk-staff-actions";
import { inviteFrontdeskStaffSchema, type InviteFrontdeskStaffInput } from "@/lib/validation/frontdesk-staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_LABELS: Record<FrontdeskStaffMember["status"], string> = {
  pending: "Invite sent",
  active: "Active",
  revoked: "Revoked",
};

const STATUS_VARIANTS: Record<FrontdeskStaffMember["status"], "default" | "secondary" | "outline"> = {
  pending: "outline",
  active: "default",
  revoked: "secondary",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * /admin/staff — grant or revoke front desk access. Receives its list from
 * the Server Component page and leans on router.refresh() after every
 * mutation to re-fetch rather than keeping a separate client-side copy, same
 * pattern as the reschedule flow: the source of truth is always the next
 * server render, not optimistic local state, since invite/revoke go through
 * the service-role client and the UI has no RLS-backed way to predict their
 * result.
 */
export function StaffManager({ staff }: { staff: FrontdeskStaffMember[] }) {
  const router = useRouter();
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<{ id: string; message: string } | null>(null);
  const [, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteFrontdeskStaffInput>({
    resolver: zodResolver(inviteFrontdeskStaffSchema),
  });

  async function onInvite(values: InviteFrontdeskStaffInput) {
    setInviteError(null);
    setInviteNotice(null);

    const result = await inviteFrontdeskStaffAction(values);

    if (!result.success) {
      setInviteError(result.message);
      return;
    }

    setInviteNotice(
      result.reinvited
        ? "Access restored — they can sign in with their existing password."
        : "Invite sent — they'll get an email to set a password.",
    );
    reset();
    router.refresh();
  }

  function onRevoke(member: FrontdeskStaffMember) {
    setRevokingId(member.id);
    setRevokeError(null);

    startTransition(async () => {
      const result = await revokeFrontdeskStaffAction(member.id);
      setRevokingId(null);

      if (!result.success) {
        setRevokeError({ id: member.id, message: result.message });
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6 p-5 sm:p-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite front desk staff</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onInvite)} className="flex flex-wrap items-start gap-3">
            <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  type="email"
                  placeholder="staff@example.com"
                  aria-invalid={!!errors.email}
                  className="h-10 rounded-lg pl-10 text-sm"
                  {...register("email")}
                />
              </div>
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <Button type="submit" disabled={isSubmitting} className="h-10">
              <UserPlus className="size-4" aria-hidden="true" />
              {isSubmitting ? "Inviting…" : "Send invite"}
            </Button>
          </form>
          {inviteError && <p className="mt-3 text-sm text-destructive">{inviteError}</p>}
          {inviteNotice && <p className="mt-3 text-sm text-[var(--amber-glow)]">{inviteNotice}</p>}
        </CardContent>
      </Card>

      {staff.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No one has been invited yet — invite the first front desk staff member above.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {staff.map((member) => (
            <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div className="flex min-w-0 flex-col">
                <span className="font-medium text-foreground">
                  {member.fullName ?? member.email ?? "Unknown"}
                </span>
                {member.fullName && member.email && (
                  <span className="text-xs text-muted-foreground">{member.email}</span>
                )}
                <span className="text-xs text-muted-foreground">
                  Invited {member.invitedAt ? formatDate(member.invitedAt) : "—"}
                  {member.invitedByName ? ` by ${member.invitedByName}` : ""}
                </span>
                {revokeError?.id === member.id && (
                  <span className="text-xs text-destructive">{revokeError.message}</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Badge variant={STATUS_VARIANTS[member.status]}>{STATUS_LABELS[member.status]}</Badge>
                {member.status !== "revoked" && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={revokingId === member.id}
                    onClick={() => onRevoke(member)}
                  >
                    {revokingId === member.id ? "Revoking…" : "Revoke"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
