import { PortfolioManager } from "@/components/admin/portfolio-manager";

// Behind app/admin/(protected)/layout.tsx's live session+admin check, so
// this page can never be meaningfully prerendered either — same reasoning
// as app/admin/(protected)/availability/page.tsx.
export const instant = false;

export default function AdminPortfolioPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 sm:p-8">
      <p className="text-sm text-muted-foreground">
        Manage the videos shown on the public /work page.
      </p>

      <PortfolioManager />
    </main>
  );
}
