import Link from "next/link";

import { getTriumphRevenueOverview } from "@/lib/repositories/triumph-admin-repository";
import { TRIUMPH_PAYMENT_STATUS_LABELS } from "@/lib/validation/triumph-payment";
import { formatKobo } from "@/lib/utils/money";
import { ReceiptDownloadButton } from "@/components/triumph-admin/receipt-download-button";
import { RealtimeRefresher } from "@/components/admin/realtime-refresher";

// Behind app/triumph-admin/(protected)/layout.tsx's live session+admin
// check — can never be meaningfully prerendered, same reasoning as every
// admin page under app/admin/(protected)/*.
export const instant = false;

const REVENUE_REALTIME_TABLES = [{ table: "triumph_payments" }];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function TriumphAdminRevenuePage() {
  const { allTimeKobo, thisMonthKobo, lastMonthKobo, payments } = await getTriumphRevenueOverview();

  return (
    <div className="flex flex-col gap-8 p-6 sm:p-8">
      <RealtimeRefresher channelName="triumph-admin-revenue" tables={REVENUE_REALTIME_TABLES} />

      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-medium text-foreground">Revenue</h1>
        <p className="text-sm text-muted-foreground">
          Every payment recorded against a Triumph project, and when it landed.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
        <div className="flex flex-col gap-1 bg-card p-5">
          <span className="font-heading text-2xl font-medium text-foreground">{formatKobo(allTimeKobo)}</span>
          <span className="text-xs text-muted-foreground">All-time</span>
        </div>
        <div className="flex flex-col gap-1 bg-card p-5">
          <span className="font-heading text-2xl font-medium text-foreground">{formatKobo(thisMonthKobo)}</span>
          <span className="text-xs text-muted-foreground">This month</span>
        </div>
        <div className="flex flex-col gap-1 bg-card p-5">
          <span className="font-heading text-2xl font-medium text-foreground">{formatKobo(lastMonthKobo)}</span>
          <span className="text-xs text-muted-foreground">Last month</span>
        </div>
        <div className="flex flex-col gap-1 bg-card p-5">
          <span className="font-heading text-2xl font-medium text-foreground">{payments.length}</span>
          <span className="text-xs text-muted-foreground">Payments recorded</span>
        </div>
      </div>

      {payments.length === 0 ? (
        <p className="border border-border p-6 text-sm text-muted-foreground">No payments recorded yet.</p>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium whitespace-nowrap">Date</th>
                <th className="px-5 py-3 font-medium">Project</th>
                <th className="px-5 py-3 font-medium whitespace-nowrap">Status</th>
                <th className="px-5 py-3 text-right font-medium whitespace-nowrap">Amount</th>
                <th className="px-5 py-3 text-right font-medium whitespace-nowrap">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b border-border transition-colors last:border-b-0 hover:bg-secondary/50">
                  <td className="px-5 py-4 align-top whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(payment.created_at)}
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="flex flex-col gap-0.5">
                      {payment.project ? (
                        <Link
                          href={`/triumph-admin/projects/${payment.project_id}`}
                          className="text-sm font-medium text-foreground hover:text-[#22e6c8]"
                        >
                          {payment.project.full_name}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium text-foreground">Unknown project</span>
                      )}
                      <span className="font-mono text-xs text-muted-foreground">
                        {payment.project?.project_code ?? payment.project_id}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 align-top whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
                      <span className="size-1.5 shrink-0 rounded-full bg-[#22e6c8]" aria-hidden="true" />
                      {TRIUMPH_PAYMENT_STATUS_LABELS[payment.payment_status]}
                    </span>
                  </td>
                  <td className="px-5 py-4 align-top text-right font-mono text-sm font-medium whitespace-nowrap text-foreground tabular-nums">
                    {formatKobo(payment.amount_kobo)}
                  </td>
                  <td className="px-5 py-4 align-top text-right whitespace-nowrap">
                    {payment.receipt_path ? (
                      <ReceiptDownloadButton filePath={payment.receipt_path} fileName={payment.receipt_name} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
