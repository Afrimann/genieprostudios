import { TriumphPackageManager } from "@/components/triumph-admin/package-manager";

// Behind app/triumph-admin/(protected)/layout.tsx's live session+admin
// check, so this page can never be meaningfully prerendered — same
// reasoning as every other admin page.
export const instant = false;

export default function TriumphAdminPackagesPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 sm:p-8">
      <p className="text-sm text-muted-foreground">
        Manage the pricing tiers customers see on the public /triumph page.
      </p>

      <TriumphPackageManager />
    </main>
  );
}
