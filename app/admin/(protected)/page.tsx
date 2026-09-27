import { Suspense } from "react";
import Link from "next/link";
import { CalendarClock, AlertTriangle, Clapperboard, ArrowUpRight } from "lucide-react";

import {
  getAdminDashboardStats,
  getRevenueOverview,
  getRecentPayments,
  getBookingStatusCounts,
} from "@/lib/repositories/admin-dashboard-repository";
import { formatKobo } from "@/lib/utils/money";
import { CountUp } from "@/components/home/count-up";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { Badge } from "@/components/ui/badge";

// Behind app/admin/(protected)/layout.tsx's live session+admin check —
// can never be meaningfully prerendered, same reasoning as every other
// admin page.
export const instant = false;

// Purely decorative meter heights (not data-driven) — same convention as
// components/home/services-teaser.tsx's rack-unit bars, reused here so the
// dashboard's stat tiles read as VU meters rather than generic dashboard
// cards.
const METER_PATTERNS = [
  [40, 70, 55, 85, 60],
  [60, 45, 80, 50, 70],
  [50, 75, 40, 65, 55],
  [70, 50, 65, 45, 80],
  [45, 65, 50, 75, 60],
];

function Meter({ pattern }: { pattern: number[] }) {
  return (
    <div className="flex items-end gap-1" aria-hidden="true">
      {pattern.map((height, i) => (
        <span
          key={i}
          style={{ height }}
          className="w-1.5 rounded-none bg-[var(--amber-glow)]/60"
        />
      ))}
    </div>
  );
}

function StatTile({
  pattern,
  display,
  value,
  suffix,
  label,
  sublabel,
}: {
  pattern: number[];
  display?: string;
  value?: number;
  suffix?: string;
  label: string;
  sublabel: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <Meter pattern={pattern} />
      <div className="flex flex-col gap-1">
        <p className="font-heading text-2xl font-medium text-foreground">
          {display ?? <CountUp to={value ?? 0} suffix={suffix} />}
        </p>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      </div>
    </div>
  );
}

async function DashboardStats() {
  const stats = await getAdminDashboardStats();

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
        pattern={METER_PATTERNS[0]}
        value={stats.openWindowsCount}
        label="Open windows"
        sublabel="Upcoming, unbooked capacity"
      />
      <StatTile
        pattern={METER_PATTERNS[1]}
        value={stats.upcomingBookingsCount}
        label="Upcoming bookings"
        sublabel="Deposited or paid in full"
      />
      <StatTile
        pattern={METER_PATTERNS[2]}
        display={formatKobo(stats.revenueThisMonthKobo)}
        label="Revenue this month"
        sublabel="Verified payments"
      />
      <StatTile
        pattern={METER_PATTERNS[3]}
        value={stats.portfolioTotalCount}
        suffix=" total"
        label="Portfolio"
        sublabel={`${stats.portfolioPublishedCount} published`}
      />

      {stats.unresolvedCount > 0 && (
        <Link
          href="/admin/bookings"
          className="flex flex-col gap-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-5 transition-colors hover:border-destructive sm:col-span-2 lg:col-span-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="size-5 text-destructive" aria-hidden="true" />
              <div className="flex flex-col">
                <p className="font-heading text-lg font-medium text-foreground">
                  {stats.unresolvedCount} unresolved past session
                  {stats.unresolvedCount === 1 ? "" : "s"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Session already happened, balance still unpaid — needs a decision.
                </p>
              </div>
            </div>
            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </div>
        </Link>
      )}
    </div>
  );
}

function SectionFallback({ heightClass = "h-32" }: { heightClass?: string }) {
  return <div className={`${heightClass} animate-pulse rounded-2xl border border-border bg-muted`} />;
}

function StatsFallback() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <SectionFallback key={i} />
      ))}
    </div>
  );
}

async function RevenueSection() {
  const revenue = await getRevenueOverview();
  const monthDeltaKobo = revenue.thisMonthKobo - revenue.lastMonthKobo;
  const paymentTotal = revenue.depositKobo + revenue.balanceKobo;
  const depositPct = paymentTotal > 0 ? Math.round((revenue.depositKobo / paymentTotal) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-heading text-xl font-medium text-foreground">Revenue</p>
          <p className="text-xs text-muted-foreground">Verified payments, last 14 days</p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <p className="text-xs text-muted-foreground">This month</p>
            <p className="font-heading text-lg font-medium text-foreground">
              {formatKobo(revenue.thisMonthKobo)}
            </p>
            <p
              className={`text-[11px] ${monthDeltaKobo >= 0 ? "text-[var(--moss)]" : "text-destructive"}`}
            >
              {monthDeltaKobo >= 0 ? "+" : ""}
              {formatKobo(monthDeltaKobo)} vs last month
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">All-time</p>
            <p className="font-heading text-lg font-medium text-foreground">
              {formatKobo(revenue.allTimeKobo)}
            </p>
          </div>
        </div>
      </div>

      <RevenueChart points={revenue.dailyLast14} />

      <div className="flex flex-col gap-1.5 border-t border-border pt-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Deposits ({formatKobo(revenue.depositKobo)})</span>
          <span>Balance payments ({formatKobo(revenue.balanceKobo)})</span>
        </div>
        <div className="flex h-2 w-full overflow-hidden rounded-none bg-secondary">
          <div
            style={{ width: `${depositPct}%` }}
            className="h-full bg-[var(--amber-glow)]"
          />
        </div>
      </div>
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  pending_deposit: "Awaiting deposit",
  deposited: "Deposit paid",
  paid_in_full: "Paid in full",
  auto_cancelled: "Auto-cancelled",
  cancelled: "Cancelled",
};

async function BookingStatusSection() {
  const counts = await getBookingStatusCounts();
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <p className="font-heading text-xl font-medium text-foreground">Bookings by status</p>
      <div className="flex flex-wrap gap-2">
        {Object.entries(counts).map(([status, count]) => (
          <Badge key={status} variant="secondary" className="gap-1.5 py-1.5">
            {STATUS_LABELS[status] ?? status}
            <span className="font-mono tabular-nums">{count}</span>
          </Badge>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{total} bookings total, all time.</p>
    </div>
  );
}

async function RecentPaymentsSection() {
  const payments = await getRecentPayments(8);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <p className="font-heading text-xl font-medium text-foreground">Recent payments</p>

      {payments.length === 0 && (
        <p className="text-sm text-muted-foreground">No verified payments yet.</p>
      )}

      {payments.length > 0 && (
        <div className="flex flex-col divide-y divide-border">
          {payments.map((payment) => (
            <div
              key={payment.id}
              className="flex items-center justify-between gap-3 py-2.5 text-sm"
            >
              <div className="flex flex-col">
                <span className="font-medium text-foreground">
                  {payment.customerName ?? "Unknown customer"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {payment.serviceLabel} ·{" "}
                  {new Date(payment.verifiedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={payment.type === "deposit" ? "outline" : "secondary"}>
                  {payment.type === "deposit" ? "Deposit" : "Balance"}
                </Badge>
                <span className="font-mono font-medium text-foreground tabular-nums">
                  {formatKobo(payment.amountKobo)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const QUICK_LINKS = [
  {
    href: "/admin/availability",
    label: "Open a window",
    description: "Add availability for customers to book into.",
    icon: CalendarClock,
  },
  {
    href: "/admin/bookings",
    label: "Review bookings",
    description: "Handle unresolved past-session balances.",
    icon: AlertTriangle,
  },
  {
    href: "/admin/portfolio",
    label: "Manage portfolio",
    description: "Add or publish work for the /work page.",
    icon: Clapperboard,
  },
];

export default function AdminDashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6 sm:p-8">
      <p className="text-sm text-muted-foreground">A read on where the studio stands right now.</p>

      <Suspense fallback={<StatsFallback />}>
        <DashboardStats />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Suspense fallback={<SectionFallback heightClass="h-64" />}>
            <RevenueSection />
          </Suspense>
        </div>
        <Suspense fallback={<SectionFallback heightClass="h-64" />}>
          <BookingStatusSection />
        </Suspense>
      </div>

      <Suspense fallback={<SectionFallback heightClass="h-48" />}>
        <RecentPaymentsSection />
      </Suspense>

      <div className="grid gap-4 sm:grid-cols-3">
        {QUICK_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex flex-col gap-3 rounded-2xl border border-border p-5 transition-colors hover:border-[var(--amber-glow)] hover:bg-[var(--amber-glow)]/5"
            >
              <Icon className="size-5 text-[var(--amber-glow)]" aria-hidden="true" />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-foreground">{link.label}</p>
                <p className="text-xs text-muted-foreground">{link.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
