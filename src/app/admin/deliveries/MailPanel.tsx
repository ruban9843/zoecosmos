"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import StatusPill from "../../../components/admin/StatusPill";

export type MailRow = {
  id: string;
  kind: string;
  to: string;
  subject: string;
  status: "PENDING" | "SENT" | "FAILED";
  attempts: number;
  lastError: string | null;
  orderCode: string | null;
  at: string;
};

const KIND_LABEL: Record<string, string> = {
  ORDER_PLACED_CUSTOMER: "Order confirmation",
  ORDER_PLACED_ADMIN: "New-order alert",
  STATUS_TYING: "Tying update",
  STATUS_OUT: "Out-for-delivery update",
  SCHEDULED_ADMIN_DIGEST: "Morning digest",
};

export default function MailPanel({ rows }: { rows: MailRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function retry(id: string) {
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/admin/notifications/${id}`, { method: "POST" });
    setBusy(null);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      setError(e.error || "Retry failed");
    }
    router.refresh();
  }

  if (rows.length === 0) return <p className="ad-hint">No emails for this day yet.</p>;

  return (
    <>
      {error && <div className="ad-alert ad-alert--error" role="alert">{error}</div>}
      <ul className="ad-mail-list">
        {rows.map((r) => (
          <li key={r.id}>
            <div className="ad-mail-main">
              <span>{KIND_LABEL[r.kind] || r.kind}{r.orderCode ? ` · ${r.orderCode}` : ""}</span>
              <span className="ad-mono-mute">{r.to}</span>
              {r.status === "FAILED" && r.lastError && <span className="ad-error-inline">{r.lastError} (attempt {r.attempts})</span>}
            </div>
            <span className="ad-mono-mute">
              {new Date(r.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}
            </span>
            <StatusPill status={r.status} />
            {r.status !== "SENT" && (
              <button className="ad-btn ad-btn--sm" disabled={busy === r.id} onClick={() => retry(r.id)}>
                {busy === r.id ? "Sending…" : "Retry"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
