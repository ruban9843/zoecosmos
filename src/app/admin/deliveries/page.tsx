import Link from "next/link";
import { prisma } from "../../../lib/prisma";
import { addDays, shopDay } from "../../../lib/delivery-date";
import InfoTip from "../../../components/admin/InfoTip";
import DeliveriesBoard, { type BoardOrder } from "./DeliveriesBoard";
import MailPanel, { type MailRow } from "./MailPanel";

const DAYS = {
  today: { offset: 0, label: "Today" },
  yesterday: { offset: -1, label: "Yesterday" },
} as const;
type DayKey = keyof typeof DAYS;

const TIPS: Record<DayKey | "mail", string> = {
  today:
    "Orders scheduled for delivery today (shop time, IST), in every status. Drag a card to update it — moving to Tying or Out for delivery emails the customer.",
  yesterday:
    "Orders that were scheduled for yesterday, including delivered and canceled ones, so you can finish stragglers and check what went out.",
  mail:
    "Emails for this day's orders: confirmations, Tying / Out-for-delivery updates and the morning admin digest. Failed emails retry automatically up to 3 times; you can also retry them here.",
};

async function loadDay(offset: number) {
  const start = shopDay(offset);
  const end = addDays(start, 1);
  return prisma.order.findMany({
    where: { deliveryDate: { gte: start, lt: end } },
    orderBy: [{ deliveryWindow: "asc" }, { createdAt: "asc" }],
    include: {
      user: { select: { name: true } },
      merchant: { select: { name: true } },
      items: {
        include: {
          product: { select: { images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true } } } },
        },
      },
    },
  });
}

export default async function AdminDeliveries({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const { day: dayParam } = await searchParams;
  const day: DayKey = dayParam === "yesterday" ? "yesterday" : "today";
  const dayDate = shopDay(DAYS[day].offset);
  const dayKey = dayDate.toISOString().slice(0, 10);

  const [todayCount, yesterdayCount, orders] = await Promise.all([
    prisma.order.count({ where: { deliveryDate: { gte: shopDay(0), lt: shopDay(1) } } }),
    prisma.order.count({ where: { deliveryDate: { gte: shopDay(-1), lt: shopDay(0) } } }),
    loadDay(DAYS[day].offset),
  ]);

  const board: BoardOrder[] = orders.map((o) => ({
    id: o.id,
    code: o.code,
    status: o.status,
    deliveryWindow: o.deliveryWindow,
    recipientName: o.merchant?.name || o.recipientName || o.user?.name || null,
    city: o.city,
    total: o.total,
    items: o.items.map((it) => ({
      id: it.id,
      name: it.productName,
      variant: it.variantLabel,
      qty: it.qty,
      imageUrl: it.imageUrl || it.product?.images[0]?.url || null,
    })),
  }));

  const picklist = new Map<string, { name: string; variant: string | null; qty: number; imageUrl: string | null }>();
  for (const o of board) {
    if (o.status === "CANCELED") continue;
    for (const it of o.items) {
      const key = `${it.name}::${it.variant ?? ""}`;
      const row = picklist.get(key) ?? { name: it.name, variant: it.variant, qty: 0, imageUrl: it.imageUrl };
      row.qty += it.qty;
      picklist.set(key, row);
    }
  }

  const notifications = await prisma.notification.findMany({
    where: {
      OR: [
        { orderId: { in: orders.map((o) => o.id) } },
        { dedupeKey: { startsWith: `digest:${dayKey}:` } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { order: { select: { code: true } } },
  });
  const mail: MailRow[] = notifications.map((n) => ({
    id: n.id,
    kind: n.kind,
    to: n.to,
    subject: n.subject,
    status: n.status,
    attempts: n.attempts,
    lastError: n.lastError,
    orderCode: n.order?.code ?? null,
    at: (n.sentAt ?? n.createdAt).toISOString(),
  }));

  return (
    <div className="ad-page">
      <div className="ad-page-head">
        <div className="ad-page-head-text">
          <span className="ad-eyebrow">
            {dayDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
          </span>
          <h1 className="ad-h1">Deliveries</h1>
          <p className="ad-h1-sub">Each card is a real order — drag it between columns or click to open it.</p>
        </div>
      </div>

      <div className="ad-tabs" role="tablist" aria-label="Delivery day">
        {(Object.keys(DAYS) as DayKey[]).map((key) => (
          <span key={key} className="ad-tab-wrap">
            <Link
              href={`/admin/deliveries?day=${key}`}
              role="tab"
              aria-selected={day === key}
              className={"ad-tab" + (day === key ? " ad-tab--on" : "")}
            >
              {DAYS[key].label} <span className="ad-tab-count">{key === "today" ? todayCount : yesterdayCount}</span>
            </Link>
            <InfoTip label={DAYS[key].label}>{TIPS[key]}</InfoTip>
          </span>
        ))}
      </div>

      <DeliveriesBoard orders={board} />

      <div className="ad-grid-2" style={{ marginTop: 18 }}>
        <div className="ad-form-section">
          <h3>Products for {DAYS[day].label.toLowerCase()} ({[...picklist.values()].reduce((s, r) => s + r.qty, 0)})</h3>
          {picklist.size === 0 ? (
            <p className="ad-hint">Nothing scheduled.</p>
          ) : (
            <ul className="ad-picklist">
              {[...picklist.values()].sort((a, b) => b.qty - a.qty).map((r) => (
                <li key={`${r.name}-${r.variant}`}>
                  {r.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.imageUrl} alt="" width={32} height={40} loading="lazy" />
                  ) : <span className="ad-thumb-ph" aria-hidden="true" />}
                  <span className="ad-picklist-name">{r.name}{r.variant ? ` · ${r.variant}` : ""}</span>
                  <b>× {r.qty}</b>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="ad-form-section">
          <h3 style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Mail service <InfoTip label="Mail service">{TIPS.mail}</InfoTip>
          </h3>
          <MailPanel rows={mail} />
        </div>
      </div>
    </div>
  );
}
