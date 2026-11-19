import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "../../../../lib/prisma";
import { formatMoney } from "../../../../lib/currency";
import { shopDayKey } from "../../../../lib/delivery-date";
import StatusPill from "../../../../components/admin/StatusPill";
import SubscriptionActions from "../../subscriptions/SubscriptionActions";
import MerchantForm from "../MerchantForm";
import MerchantProducts from "./MerchantProducts";
import SubscriptionForm from "./SubscriptionForm";

const CADENCE: Record<string, string> = { WEEKLY: "Weekly", FORTNIGHTLY: "Fortnightly", MONTHLY: "Monthly" };

export default async function AdminMerchantDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [merchant, products] = await Promise.all([
    prisma.merchant.findUnique({
      where: { id },
      include: {
        products: {
          orderBy: { product: { name: "asc" } },
          include: { product: { include: { variants: { orderBy: { sortOrder: "asc" }, take: 1 } } }, variant: true },
        },
        subscriptions: {
          orderBy: [{ status: "asc" }, { nextDelivery: "asc" }],
          include: { items: { include: { merchantProduct: { include: { product: { select: { name: true } }, variant: { select: { label: true } } } } } } },
        },
      },
    }),
    prisma.product.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, basePrice: true, variants: { orderBy: { sortOrder: "asc" }, select: { id: true, label: true, priceDelta: true } } },
    }),
  ]);
  if (!merchant) notFound();

  const lines = merchant.products.map((mp) => {
    const variant = mp.variant ?? mp.product.variants[0];
    return {
      id: mp.id,
      productName: mp.product.name,
      variantLabel: mp.variant?.label ?? null,
      catalogPrice: mp.product.basePrice + (variant?.priceDelta ?? 0),
      priceOverride: mp.priceOverride,
      active: mp.active,
    };
  });

  return (
    <div className="ad-page">
      <Link href="/admin/merchants" className="ad-link-btn" style={{ marginBottom: 14, display: "inline-block" }}>← Merchant stores</Link>
      <div className="ad-page-head">
        <div className="ad-page-head-text">
          <span className="ad-eyebrow">Merchant store</span>
          <h1 className="ad-h1">{merchant.name} <StatusPill status={merchant.active ? "ACTIVE" : "INACTIVE"} /></h1>
          <p className="ad-h1-sub">{merchant.email}{merchant.phone ? ` · ${merchant.phone}` : ""}</p>
        </div>
      </div>

      <div className="ad-grid-2">
        <div>
          <MerchantForm merchant={merchant} />
          <MerchantProducts merchantId={merchant.id} lines={lines} options={products} />
        </div>
        <div>
          <div className="ad-form-section">
            <h3>Subscriptions ({merchant.subscriptions.length})</h3>
            {merchant.subscriptions.length === 0 ? (
              <p className="ad-hint">No subscriptions yet.</p>
            ) : (
              <ul className="ad-sub-list">
                {merchant.subscriptions.map((s) => (
                  <li key={s.id}>
                    <div>
                      <b>{CADENCE[s.cadence]}</b> · {formatMoney(s.value)}/delivery <StatusPill status={s.status} />
                      <div className="ad-mono-mute">
                        Next: {s.nextDelivery ? s.nextDelivery.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" }) : "—"}
                        {" · "}delivered {s.deliveredCount}{s.totalCycles ? ` / ${s.totalCycles}` : ""}
                      </div>
                      <div style={{ fontSize: 12 }}>
                        {s.items.map((it) => `${it.qty}× ${it.merchantProduct.product.name}${it.merchantProduct.variant ? ` (${it.merchantProduct.variant.label})` : ""}`).join(", ")}
                      </div>
                    </div>
                    <SubscriptionActions id={s.id} status={s.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          {merchant.active && (
            <div className="ad-form-section">
              <h3>New subscription</h3>
              <SubscriptionForm
                merchantId={merchant.id}
                minDate={shopDayKey(1)}
                lines={lines.filter((l) => l.active).map((l) => ({ id: l.id, label: `${l.productName}${l.variantLabel ? ` · ${l.variantLabel}` : ""}` }))}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
