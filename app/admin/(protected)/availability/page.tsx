import { AvailabilityManager } from "@/components/admin/availability-manager";

// Behind app/admin/(protected)/layout.tsx's live session+admin check, so
// this page can never be meaningfully prerendered either — same reasoning
// as the layout itself. Mirrors the layout's own instant=false treatment.
export const instant = false;

export default function AdminAvailabilityPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 sm:p-8">
      <p className="text-sm text-muted-foreground">
        Open or close windows of time for customers to book into.
      </p>

      <AvailabilityManager />
    </main>
  );
}
