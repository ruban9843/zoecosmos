"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Line = { id: string; label: string };

export default function SubscriptionForm({ merchantId, lines, minDate }: { merchantId: string; lines: Line[]; minDate: string }) {
  const router = useRouter();
  const [cadence, setCadence] = useState("WEEKLY");
  const [nextDelivery, setNextDelivery] = useState(minDate);
  const [totalCycles, setTotalCycles] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (lines.length === 0) {
    return <p className="ad-hint">Add products for this merchant first — subscriptions can only include them.</p>;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = Object.entries(qty)
      .map(([merchantProductId, q]) => ({ merchantProductId, qty: Math.round(Number(q) || 0) }))
      .filter((i) => i.qty > 0);
    if (items.length === 0) return setError("Set a quantity for at least one product.");
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ merchantId, cadence, nextDelivery, totalCycles: totalCycles ? Number(totalCycles) : null, items }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error || "Could not create subscription");
    setQty({});
    router.refresh();
  };

  return (
    <form onSubmit={submit}>
      {error && <div className="ad-alert ad-alert--error" role="alert">{error}</div>}
      <div className="ad-form-row-2">
        <div className="ad-form-row">
          <label htmlFor="sub-cadence">Every</label>
          <select id="sub-cadence" value={cadence} onChange={(e) => setCadence(e.target.value)}>
            <option value="WEEKLY">Week</option>
            <option value="FORTNIGHTLY">Two weeks</option>
            <option value="MONTHLY">Month</option>
          </select>
        </div>
        <div className="ad-form-row">
          <label htmlFor="sub-first">First delivery</label>
          <input id="sub-first" type="date" min={minDate} required value={nextDelivery} onChange={(e) => setNextDelivery(e.target.value)} />
        </div>
        <div className="ad-form-row">
          <label htmlFor="sub-cycles">Number of deliveries (blank = ongoing)</label>
          <input id="sub-cycles" type="number" min={1} value={totalCycles} onChange={(e) => setTotalCycles(e.target.value)} />
        </div>
      </div>
      <table className="ad-table" style={{ fontSize: 13, marginBottom: 12 }}>
        <thead><tr><th>Product</th><th>Qty per delivery</th></tr></thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id}>
              <td>{l.label}</td>
              <td>
                <input className="ad-input ad-input--mono" style={{ width: 72 }} type="number" min={0} max={500}
                  aria-label={`Quantity of ${l.label}`} value={qty[l.id] ?? ""}
                  onChange={(e) => setQty((q) => ({ ...q, [l.id]: e.target.value }))} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="ad-btn ad-btn--dark" disabled={busy}>{busy ? "Creating…" : "Create subscription"}</button>
    </form>
  );
}
