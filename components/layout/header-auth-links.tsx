import { getCurrentUser } from "@/lib/auth/current-user";
import { BookingsIconLink } from "@/components/layout/bookings-icon-link";
import { SupportIconLink } from "@/components/layout/support-icon-link";
import { SignOutButton } from "@/components/layout/sign-out-button";

// Uses the shared, per-request-memoized getCurrentUser() (see
// lib/auth/current-user.ts) rather than each icon link independently
// calling auth.getUser() — this component itself is also rendered twice per
// page (desktop nav + mobile panel, see site-header.tsx), so without the
// memoization this alone would already be 2 concurrent reads, before even
// counting a page's own content-area auth read (e.g. app/(marketing)/contact/page.tsx).
export async function HeaderAuthLinks() {
  const user = await getCurrentUser();

  return (
    <>
      <SupportIconLink visible={Boolean(user)} />
      <BookingsIconLink visible={Boolean(user)} />
      {/* Last in the row — destructive-ish actions sit at the end, and this
          renders in both the desktop nav and the mobile panel because
          site-header.tsx mounts this component in both places. */}
      <SignOutButton visible={Boolean(user)} />
    </>
  );
}
