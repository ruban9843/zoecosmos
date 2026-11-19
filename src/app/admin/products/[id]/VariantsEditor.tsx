"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Variant = {
  id: string;
  label: string;
  sku: string;
  stems: number | null;
  priceDelta: number;
  stockQty: number;
};

const toPaise = (rupees: string) => Math.round(parseFloat(rupees || "0") * 100);

async function errorOf(res: Response) {
  const e = await res.json().catch(() => ({}));
  return e.error || `HTTP ${res.status}`;
}

function Row({ productId, variant }: { productId: string; variant: Variant }) {
  const router = useRouter();
  const [stockQty, setStockQty] = useState(String(variant.stockQty));
  const [priceDelta, setPriceDelta] = useState((variant.priceDelta / 100).toFixed(2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dirty = Number(stockQty) !== variant.stockQty || toPaise(priceDelta) !== variant.priceDelta;
  const url = `/api/admin/products/${productId}/variants/${variant.id}`;

  const save = async () => {
    setSaving(true);
    setError("");
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        stockQty: Math.max(0, Math.round(Number(stockQty) || 0)),
        priceDelta: toPaise(priceDelta),
      }),
    });
    setSaving(false);
    if (!res.ok) return setError(await errorOf(res));
    router.refresh();
  };

  const remove = async () => {
    if (!confirm(`Delete the "${variant.label}" variant? It is removed from carts; past orders are kept.`)) return;
    setSaving(true);
    setError("");
    const res = await fetch(url, { method: "DELETE" });
    setSaving(false);
    if (!res.ok) return setError(await errorOf(res));
    router.refresh();
  };

  return (
    <tr>
      <td>{variant.label}</td>
      <td><span className="ad-table-id">{variant.sku}</span></td>
      <td>{variant.stems || "—"}</td>
      <td>
        <input
          className="ad-input ad-input--mono"
          style={{ width: 80 }}
          type="number" step="0.01"
          aria-label={`${variant.label} price difference`}
          value={priceDelta}
          onChange={(e) => setPriceDelta(e.target.value)}
        />
      </td>
      <td>
        <input
          className="ad-input ad-input--mono"
          style={{ width: 64 }}
          type="number" min={0} step={1}
          aria-label={`${variant.label} stock`}
          value={stockQty}
          onChange={(e) => setStockQty(e.target.value)}
        />
      </td>
      <td style={{ whiteSpace: "nowrap" }}>
        <button className="ad-btn ad-btn--sm" disabled={!dirty || saving} onClick={save}>
          {saving ? "Saving…" : "Save"}
        </button>{" "}
        <button className="ad-btn ad-btn--sm ad-btn--danger" disabled={saving} onClick={remove} aria-label={`Delete ${variant.label}`}>
          ✕
        </button>
        {error && <div className="ad-error-inline">{error}</div>}
      </td>
    </tr>
  );
}

function AddRow({ productId, productSku, count }: { productId: string; productSku: string; count: number }) {
  const router = useRouter();
  const empty = { label: "", sku: "", stems: "", priceDelta: "0", stockQty: "0" };
  const [f, setF] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  const add = async () => {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/admin/products/${productId}/variants`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: f.label.trim(),
        sku: f.sku.trim() || `${productSku}-${count + 1}`,
        stems: f.stems ? Math.max(0, Math.round(Number(f.stems))) : null,
        priceDelta: toPaise(f.priceDelta),
        stockQty: Math.max(0, Math.round(Number(f.stockQty) || 0)),
      }),
    });
    setSaving(false);
    if (!res.ok) return setError(await errorOf(res));
    setF(empty);
    router.refresh();
  };

  return (
    <tr>
      <td><input className="ad-input" style={{ width: 96 }} placeholder="Label" aria-label="New variant label" value={f.label} onChange={set("label")} /></td>
      <td><input className="ad-input ad-input--mono" style={{ width: 110 }} placeholder={`${productSku}-${count + 1}`} aria-label="New variant SKU" value={f.sku} onChange={set("sku")} /></td>
      <td><input className="ad-input ad-input--mono" style={{ width: 56 }} type="number" min={0} aria-label="New variant stems" value={f.stems} onChange={set("stems")} /></td>
      <td><input className="ad-input ad-input--mono" style={{ width: 80 }} type="number" step="0.01" aria-label="New variant price difference" value={f.priceDelta} onChange={set("priceDelta")} /></td>
      <td><input className="ad-input ad-input--mono" style={{ width: 64 }} type="number" min={0} aria-label="New variant stock" value={f.stockQty} onChange={set("stockQty")} /></td>
      <td>
        <button className="ad-btn ad-btn--sm ad-btn--dark" disabled={!f.label.trim() || saving} onClick={add}>
          {saving ? "Adding…" : "+ Add"}
        </button>
        {error && <div className="ad-error-inline">{error}</div>}
      </td>
    </tr>
  );
}

export default function VariantsEditor({ productId, productSku, variants }: { productId: string; productSku: string; variants: Variant[] }) {
  return (
    <>
      {variants.length === 0 && (
        <p className="ad-hint">This product has no variants, so customers can&apos;t buy it yet. Add at least one.</p>
      )}
      <table className="ad-table" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Label</th><th>SKU</th><th>Stems</th><th>Δ price (₹)</th><th>Stock</th><th></th>
          </tr>
        </thead>
        <tbody>
          {variants.map((v) => <Row key={v.id} productId={productId} variant={v} />)}
          <AddRow productId={productId} productSku={productSku} count={variants.length} />
        </tbody>
      </table>
    </>
  );
}
