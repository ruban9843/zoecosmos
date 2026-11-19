"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type MerchantFields = {
  id?: string;
  name: string;
  slug: string;
  contactName: string | null;
  email: string;
  phone: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  zip: string | null;
  active?: boolean;
};

const FIELDS: { key: keyof MerchantFields; label: string; required?: boolean; type?: string }[] = [
  { key: "name", label: "Store name", required: true },
  { key: "slug", label: "Slug", required: true },
  { key: "contactName", label: "Contact person" },
  { key: "email", label: "Email", required: true, type: "email" },
  { key: "phone", label: "Phone", type: "tel" },
  { key: "addressLine1", label: "Address", required: true },
  { key: "addressLine2", label: "Address line 2" },
  { key: "city", label: "City", required: true },
  { key: "zip", label: "PIN / ZIP" },
];

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export default function MerchantForm({ merchant }: { merchant?: MerchantFields }) {
  const router = useRouter();
  const isNew = !merchant?.id;
  const [f, setF] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map(({ key }) => [key, (merchant?.[key] as string | null) ?? ""])),
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async (extra: Record<string, unknown> = {}) => {
    setBusy(true);
    setMsg(null);
    const res = await fetch(isNew ? "/api/admin/merchants" : `/api/admin/merchants/${merchant!.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...f, ...extra }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg({ ok: false, text: data.error || "Save failed" });
    if (isNew) {
      router.push(`/admin/merchants/${data.merchant.id}`);
    } else {
      setMsg({ ok: true, text: "Saved." });
      router.refresh();
    }
  };

  const remove = async () => {
    if (!confirm(`Delete ${merchant!.name}? Its subscriptions are removed; past orders are kept.`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/merchants/${merchant!.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: (await res.json().catch(() => ({}))).error || "Delete failed" });
    router.push("/admin/merchants");
    router.refresh();
  };

  return (
    <form
      className="ad-form-section"
      onSubmit={(e) => { e.preventDefault(); save(); }}
    >
      <h3>{isNew ? "New merchant store" : "Details"}</h3>
      <div className="ad-form-row-2">
        {FIELDS.map(({ key, label, required, type }) => (
          <div key={key} className="ad-form-row">
            <label htmlFor={`m-${key}`}>{label}{required ? " *" : ""}</label>
            <input
              id={`m-${key}`}
              type={type || "text"}
              required={required}
              value={f[key]}
              onChange={(e) => {
                const value = e.target.value;
                setF((s) => ({
                  ...s,
                  [key]: value,
                  ...(key === "name" && isNew && (!s.slug || s.slug === slugify(s.name)) ? { slug: slugify(value) } : {}),
                }));
              }}
            />
          </div>
        ))}
      </div>
      <div className="ad-actions" style={{ justifyContent: "flex-start" }}>
        <button className="ad-btn ad-btn--dark" disabled={busy}>{busy ? "Saving…" : isNew ? "Create merchant" : "Save"}</button>
        {!isNew && (
          <>
            <button type="button" className="ad-btn" disabled={busy} onClick={() => save({ active: !merchant!.active })}>
              {merchant!.active ? "Deactivate" : "Activate"}
            </button>
            <button type="button" className="ad-btn ad-btn--danger" disabled={busy} onClick={remove}>Delete</button>
          </>
        )}
        {msg && <span className={msg.ok ? "ad-ok-inline" : "ad-error-inline"}>{msg.text}</span>}
      </div>
    </form>
  );
}
