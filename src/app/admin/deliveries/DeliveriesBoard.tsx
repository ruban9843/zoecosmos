"use client";
/**
 * Delivery-day fulfilment board. Cards drag between columns; dropping one PATCHes
 * the order's status via /api/admin/orders/[id]. Optimistic move, reverts on error.
 * Clicking a card (without dragging) opens the order.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@prisma/client";
import { formatMoney } from "../../../lib/currency";
import { canTransition, STATUS_LABEL } from "../../../lib/order-status";

export type BoardOrder = {
  id: string;
  code: string;
  status: OrderStatus;
  deliveryWindow: string | null;
  recipientName: string | null;
  city: string | null;
  total: number;
  items: { id: string; name: string; variant: string | null; qty: number; imageUrl: string | null }[];
};

const COLUMNS: { key: OrderStatus; dot: string }[] = [
  { key: "NEW", dot: "var(--ad-tan)" },
  { key: "TYING", dot: "var(--ad-accent)" },
  { key: "READY", dot: "var(--ad-sage)" },
  { key: "OUT_FOR_DELIVERY", dot: "var(--ad-ok)" },
  { key: "DELIVERED", dot: "var(--ad-ink-mute)" },
  { key: "CANCELED", dot: "var(--ad-warn)" },
];

type Board = Record<OrderStatus, BoardOrder[]>;

function group(orders: BoardOrder[]): Board {
  const g: Board = { NEW: [], TYING: [], READY: [], OUT_FOR_DELIVERY: [], DELIVERED: [], CANCELED: [] };
  for (const o of orders) g[o.status]?.push(o);
  return g;
}

export default function DeliveriesBoard({ orders }: { orders: BoardOrder[] }) {
  const router = useRouter();
  const [board, setBoard] = useState<Board>(() => group(orders));
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Server data wins after every refresh / day switch.
  useEffect(() => { setBoard(group(orders)); }, [orders]);

  async function move(id: string, to: OrderStatus) {
    const from = (Object.keys(board) as OrderStatus[]).find((k) => board[k].some((o) => o.id === id));
    if (!from || from === to) return;
    const card = board[from].find((o) => o.id === id)!;
    if (!canTransition(from, to)) {
      setError(`${card.code} can't move from ${STATUS_LABEL[from]} to ${STATUS_LABEL[to]}.`);
      return;
    }
    if (to === "CANCELED" && !confirm(`Cancel ${card.code}? Stock goes back on the shelf.`)) return;

    const prev = board;
    setBoard((b) => ({
      ...b,
      [from]: b[from].filter((o) => o.id !== id),
      [to]: [{ ...card, status: to }, ...b[to]],
    }));
    setError(null);

    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: to }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e: any) {
      setBoard(prev);
      setError(`Couldn't move ${card.code}: ${e.message}`);
    }
  }

  return (
    <>
      {error && <div className="ad-alert ad-alert--error" role="alert">{error}</div>}
      <div className="ad-board">
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className={"ad-board-col" + (over === col.key ? " ad-board-col--over" : "")}
            onDragOver={(e) => { e.preventDefault(); setOver(col.key); }}
            onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              if (dragId) move(dragId, col.key);
              setDragId(null);
            }}
          >
            <div className="ad-board-col-head">
              <div className="ad-board-col-title">
                <span className="ad-dot" style={{ background: col.dot }} />
                {STATUS_LABEL[col.key]}
              </div>
              <span className="ad-board-count">{board[col.key].length}</span>
            </div>
            <div className="ad-board-cards">
              {board[col.key].length === 0 ? (
                <div className="ad-board-empty">—</div>
              ) : board[col.key].map((o) => (
                <div
                  key={o.id}
                  draggable
                  role="link"
                  tabIndex={0}
                  className="ad-board-card"
                  onDragStart={() => setDragId(o.id)}
                  onDragEnd={() => { setDragId(null); setOver(null); }}
                  onClick={() => router.push(`/admin/orders/${o.code}`)}
                  onKeyDown={(e) => { if (e.key === "Enter") router.push(`/admin/orders/${o.code}`); }}
                  style={{ opacity: dragId === o.id ? 0.5 : 1 }}
                >
                  <div className="ad-board-card-top">
                    <span className="ad-mono-mute">{o.code}</span>
                    <span className="ad-chip">{o.deliveryWindow || "—"}</span>
                  </div>
                  <div className="ad-board-card-name">{o.recipientName || "Guest"}</div>
                  <div className="ad-board-card-sub">
                    {o.city || ""} · <span className="ad-mono">{formatMoney(o.total)}</span>
                  </div>
                  {o.items.length > 0 && (
                    <ul className="ad-board-items">
                      {o.items.map((it) => (
                        <li key={it.id}>
                          {it.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={it.imageUrl} alt="" width={24} height={30} loading="lazy" />
                          ) : <span className="ad-thumb-ph" aria-hidden="true" />}
                          <span>{it.name}{it.variant ? ` · ${it.variant}` : ""}</span>
                          <b>×{it.qty}</b>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
