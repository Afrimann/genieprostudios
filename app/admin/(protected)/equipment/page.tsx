import { EquipmentManager } from "@/components/admin/equipment-manager";

// Behind app/admin/(protected)/layout.tsx's live session+admin check, so
// this page can never be meaningfully prerendered either — same reasoning
// as every other admin page.
export const instant = false;

export default function AdminEquipmentPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 sm:p-8">
      <p className="text-sm text-muted-foreground">
        Manage the equipment inventory customers see before booking.
      </p>

      <EquipmentManager />
    </main>
  );
}
