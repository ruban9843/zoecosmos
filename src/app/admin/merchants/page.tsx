import Link from "next/link";
import { prisma } from "../../../lib/prisma";
import StatusPill from "../../../components/admin/StatusPill";
import ClickableRow from "../../../components/admin/ClickableRow";
import MerchantForm from "./MerchantForm";

export default async function AdminMerchants() {
  const merchants = await prisma.merchant.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { products: true } },
      subscriptions: { where: { status: "ACTIVE" }, select: { id: true } },
    },
  });

  return (
    <div className="ad-page">
      <div className="ad-page-head">
        <div className="ad-page-head-text">
          <span className="ad-eyebrow">Commerce</span>
          <h1 className="ad-h1">Merchant stores</h1>
          <p className="ad-h1-sub">Business customers with their own product list. Only merchants can have subscriptions.</p>
        </div>
      </div>

      <div className="ad-table-wrap" style={{ marginBottom: 18 }}>
        <table className="ad-table">
          <thead>
            <tr><th>Store</th><th>Contact</th><th>City</th><th style={{ textAlign: "right" }}>Products</th><th style={{ textAlign: "right" }}>Active subs</th><th>Status</th></tr>
          </thead>
          <tbody>
            {merchants.length === 0 ? (
              <tr><td colSpan={6} className="ad-hint" style={{ padding: 24, textAlign: "center" }}>No merchant stores yet — add one below.</td></tr>
            ) : merchants.map((m) => (
              <ClickableRow key={m.id} href={`/admin/merchants/${m.id}`}>
                <td><Link href={`/admin/merchants/${m.id}`} style={{ fontWeight: 500 }}>{m.name}</Link></td>
                <td>{m.contactName || "—"}<div className="ad-mono-mute">{m.email}</div></td>
                <td>{m.city}</td>
                <td style={{ textAlign: "right" }}>{m._count.products}</td>
                <td style={{ textAlign: "right" }}>{m.subscriptions.length}</td>
                <td><StatusPill status={m.active ? "ACTIVE" : "INACTIVE"} /></td>
              </ClickableRow>
            ))}
          </tbody>
        </table>
      </div>

      <MerchantForm />
    </div>
  );
}
