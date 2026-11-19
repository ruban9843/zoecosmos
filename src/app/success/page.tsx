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
      <h1>Thank you!</h1>
      <p>
        Your order has been received. A member of our team will contact you shortly to confirm
        the details, and your order will be on its way to you soon.
      </p>

      {order && order.items.length > 0 && (
        <ul className="fs-success-items">
          {order.items.map((it) => (
            <li key={it.id}>
              {it.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.imageUrl} alt="" width={56} height={70} loading="lazy" />
              ) : (
                <span className="fs-success-items-ph" aria-hidden="true" />
              )}
              <span>
                {it.productName}
                {it.variantLabel ? ` · ${it.variantLabel}` : ""} × {it.qty}
              </span>
            </li>
          ))}
        </ul>
      )}

      {order && (
        <div className="fs-success-meta">
          <div><b>Delivery</b><span>{order.deliveryDate ? order.deliveryDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : order.deliveryWindow}</span></div>
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
