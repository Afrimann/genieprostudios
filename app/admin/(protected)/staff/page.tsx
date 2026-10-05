import type { Metadata } from "next";

import { listFrontdeskStaff } from "@/lib/repositories/frontdesk-staff-repository";
import { StaffManager } from "@/components/admin/staff-manager";

export const instant = false;

export const metadata: Metadata = {
  title: "Staff",
  robots: { index: false, follow: false },
};

/** Grant/revoke /frontdesk access — see lib/services/frontdesk-staff-actions.ts for the invite flow this drives. */
export default async function AdminStaffPage() {
  const staff = await listFrontdeskStaff();

  return <StaffManager staff={staff} />;
}
