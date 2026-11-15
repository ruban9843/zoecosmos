import React from "react";
import Link from "next/link";
import BouquetIllustration from "../../components/BouquetIllustration";
import { findViewableOrder } from "../../lib/orders";
import { formatMoney } from "../../lib/currency";

const fmt = formatMoney;

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const order = code ? await findViewableOrder(code) : null;

  return (
    <main className="fs-success">
      <div className="fs-success-art">
        <BouquetIllustration
          palette={["#e8c8b9","#f7d76b","#9bb38a","#f5b8c4"]}
          className="fs-success-img"
        />
      </div>
      <span className="fs-section-eyebrow">Order {order?.code || "received"}</span>
      <h1>Off they go.</h1>
      <p>
        We&apos;ve received your order. We&apos;ll contact you soon to confirm delivery and payment.
      </p>

      {order && (
        <div className="fs-success-meta">
          <div><b>Delivery</b><span>{order.deliveryWindow}</span></div>
          <div><b>Recipient</b><span>{order.recipientName || "You"}</span></div>
          <div><b>Total</b><span>{fmt(order.total)}</span></div>
        </div>
      )}

      <div className="fs-success-actions">
        <Link href="/" className="fs-btn fs-btn--dark">Back to the shop</Link>
        <Link href={`/account/orders`} className="fs-btn fs-btn--ghost">Track this order →</Link>
      </div>
    </main>
  );
}
