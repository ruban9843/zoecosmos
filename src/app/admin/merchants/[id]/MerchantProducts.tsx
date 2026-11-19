"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "../../../../lib/currency";

type Option = { id: string; name: string; basePrice: number; variants: { id: string; label: string; priceDelta: number }[] };
type Line = {
  id: string;
  productName: string;
  variantLabel: string | null;
  catalogPrice: number;
  priceOverride: number | null;
  active: boolean;
};

async function errorOf(res: Response) {
  return (await res.json().catch(() => ({}))).error || `HTTP ${res.status}`;
}

export default function MerchantProducts({ merchantId, lines, options }: { merchantId: string; lines: Line[]; options: Option[] }) {
  const router = useRouter();
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [price, setPrice] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const product = options.find((o) => o.id === productId);
  const base = `/api/admin/merchants/${merchantId}/products`;

  const call = async (key: string, url: string, init: RequestInit) => {
    setBusy(key);
    setError(null);
    const res = await fetch(url, { ...init, headers: { "content-type": "application/json" } });
    setBusy(null);
    if (!res.ok) { setError(await errorOf(res)); return false; }
    router.refresh();
    return true;
  };

  const add = async () => {
    const ok = await call("add", base, {
      method: "POST",
      body: JSON.stringify({
        productId,
        variantId: variantId || null,
        priceOverride: price.trim() ? Math.round(parseFloat(price) * 100) : null,
      }),
    });
    if (ok) { setProductId(""); setVariantId(""); setPrice(""); }
  };

  return (
    <div className="ad-form-section">
      <h3>Products for this merchant ({lines.length})</h3>
      {error && <div className="ad-alert ad-alert--error" role="alert">{error}</div>}
      <table className="ad-table" style={{ fontSize: 13 }}>
        <thead><tr><th>Product</th><th style={{ textAlign: "right" }}>Catalogue</th><th>Agreed price (₹)</th><th></th></tr></thead>
        <tbody>
          {lines.map((l) => {
            const value = prices[l.id] ?? (l.priceOverride != null ? String(l.priceOverride / 100) : "");
            return (
              <tr key={l.id} style={{ opacity: l.active ? 1 : 0.55 }}>
                <td>{l.productName}{l.variantLabel ? ` · ${l.variantLabel}` : " · any size"}</td>
                <td className="ad-table-money">{formatMoney(l.catalogPrice)}</td>
                <td>
                  <input
                    className="ad-input ad-input--mono" style={{ width: 96 }} type="number" min={0} step="1"
                    placeholder="catalogue" aria-label={`Agreed price for ${l.productName}`}
                    value={value}
                    onChange={(e) => setPrices((p) => ({ ...p, [l.id]: e.target.value }))}
                    onBlur={() => {
                      const next = value.trim() ? Math.round(parseFloat(value) * 100) : null;
                      if (next !== l.priceOverride) call(l.id, `${base}/${l.id}`, { method: "PATCH", body: JSON.stringify({ priceOverride: next }) });
                    }}
                  />
                </td>
                <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                  <button className="ad-btn ad-btn--sm" disabled={busy === l.id}
                    onClick={() => call(l.id, `${base}/${l.id}`, { method: "PATCH", body: JSON.stringify({ active: !l.active }) })}>
                    {l.active ? "Pause" : "Resume"}
                  </button>{" "}
                  <button className="ad-btn ad-btn--sm ad-btn--danger" disabled={busy === l.id} aria-label={`Remove ${l.productName}`}
                    onClick={() => { if (confirm("Remove this product? It is also removed from this merchant's subscriptions.")) call(l.id, `${base}/${l.id}`, { method: "DELETE" }); }}>
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
          <tr>
            <td>
              <select className="ad-input" aria-label="Product to add" value={productId} onChange={(e) => { setProductId(e.target.value); setVariantId(""); }}>
                <option value="">Add a product…</option>
                {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              {product && product.variants.length > 0 && (
                <select className="ad-input" aria-label="Variant" style={{ marginTop: 6 }} value={variantId} onChange={(e) => setVariantId(e.target.value)}>
                  <option value="">Any size (first variant)</option>
                  {product.variants.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                </select>
              )}
            </td>
            <td className="ad-table-money">
              {product ? formatMoney(product.basePrice + (product.variants.find((v) => v.id === variantId)?.priceDelta ?? product.variants[0]?.priceDelta ?? 0)) : ""}
            </td>
            <td>
              <input className="ad-input ad-input--mono" style={{ width: 96 }} type="number" min={0} step="1" placeholder="catalogue"
                aria-label="Agreed price" value={price} onChange={(e) => setPrice(e.target.value)} />
            </td>
            <td style={{ textAlign: "right" }}>
              <button className="ad-btn ad-btn--sm ad-btn--dark" disabled={!productId || busy === "add"} onClick={add}>+ Add</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
