import type { RevenuePoint } from "@/lib/repositories/admin-dashboard-repository";
import { formatKobo } from "@/lib/utils/money";

/**
 * Daily revenue bars for the last N days — plain flex/div bars (height as a
 * percentage of the local max), same visual convention as
 * components/home/services-teaser.tsx's rack-unit bars, rather than pulling
 * in a charting dependency for one simple bar chart. `title` gives an exact
 * value on hover since the bars themselves are necessarily too thin to
 * label individually.
 */
export function RevenueChart({ points }: { points: RevenuePoint[] }) {
  const max = Math.max(...points.map((p) => p.kobo), 1);

  return (
    <div className="flex h-28 items-end gap-1.5">
      {points.map((point) => {
        const heightPct = point.kobo > 0 ? Math.max((point.kobo / max) * 100, 4) : 2;
        const day = new Date(`${point.date}T00:00:00`).getDate();

        return (
          <div
            key={point.date}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
            title={`${point.date}: ${formatKobo(point.kobo)}`}
          >
            <div className="flex w-full flex-1 items-end">
              <div
                style={{ height: `${heightPct}%` }}
                className="w-full rounded-t-sm bg-[var(--amber-glow)]/70 transition-colors hover:bg-[var(--amber-glow)]"
              />
            </div>
            <span className="text-[9px] text-muted-foreground">{day}</span>
          </div>
        );
      })}
    </div>
  );
}
