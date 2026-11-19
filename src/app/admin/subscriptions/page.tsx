import Link from "next/link";
import { prisma } from "../../../lib/prisma";
import StatusPill from "../../../components/admin/StatusPill";
import SubscriptionActions from "./SubscriptionActions";
import { formatMoney } from "../../../lib/currency";

const fmt = formatMoney;
const cadenceLabel: Record<string, string> = { WEEKLY: "Weekly", FORTNIGHTLY: "Fortnightly", MONTHLY: "Monthly" };

export default async function AdminSubscriptions() {
  const subs = await prisma.subscription.findMany({
    orderBy: [{ status: "asc" }, { nextDelivery: "asc" }],
    include: {
      user: { select: { name: true, email: true } },
      merchant: { select: { id: true, name: true } },
      items: { include: { merchantProduct: { include: { product: { select: { name: true } } } } } },
    },
  });
  const active = subs.filter((s) => s.status === "ACTIVE");
  const mrr = active.reduce((s, sub) => s + monthlyize(sub.value, sub.cadence), 0);

  return (
    <div className="ad-page">
      <div className="ad-page-head">
        <div className="ad-page-head-text">
          <span className="ad-eyebrow">Commerce</span>
          <h1 className="ad-h1">Subscriptions</h1>
          <p className="ad-h1-sub">{active.length} active · ~{fmt(mrr)} MRR · subscriptions belong to merchant stores</p>
        </div>
        <div className="ad-actions">
          <Link href="/admin/merchants" className="ad-btn ad-btn--dark">Manage merchants</Link>
        </div>
      </div>

      <div className="ad-table-wrap">
        <table className="ad-table">
          <thead><tr>
            <th>ID</th><th>Merchant</th><th>Plan</th>
            <th>Next delivery</th><th>Delivered</th>
            <th style={{ textAlign: "right" }}>Value</th><th>Status</th>
            <th style={{ textAlign: "right" }}>Actions</th>
          </tr></thead>
          <tbody>
            {subs.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "var(--ad-ink-mute)" }}>No subscriptions yet.</td></tr>
            ) : subs.map((s: any) => (
              <tr key={s.id}>
                <td><span className="ad-table-id">{s.id.slice(0, 8)}</span></td>
                <td>
                  {s.merchant ? (
                    <Link href={`/admin/merchants/${s.merchant.id}`} style={{ fontWeight: 500 }}>{s.merchant.name}</Link>
                  ) : (
                    <div style={{ fontWeight: 500 }}>{s.user?.name || s.user?.email} <span className="ad-mono-mute">(legacy, no merchant)</span></div>
                  )}
                  {s.items.length > 0 && (
                    <div className="ad-mono-mute">{s.items.map((it: any) => `${it.qty}× ${it.merchantProduct.product.name}`).join(", ")}</div>
                  )}
                </td>
                <td>{cadenceLabel[s.cadence]}</td>
                <td>{s.nextDelivery ? new Date(s.nextDelivery).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }) : "—"}</td>
                <td style={{ fontFamily: "var(--font-mono), monospace" }}>{s.deliveredCount}{s.totalCycles ? ` / ${s.totalCycles}` : ""}</td>
                <td className="ad-table-money">{fmt(s.value)}/cycle</td>
                <td><StatusPill status={s.status} /></td>
                <td><SubscriptionActions id={s.id} status={s.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function monthlyize(value: number, cadence: string) {
  if (cadence === "WEEKLY") return value * 4;
  if (cadence === "FORTNIGHTLY") return value * 2;
  return value;
}
