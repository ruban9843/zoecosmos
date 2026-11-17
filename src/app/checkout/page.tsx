"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "../../hooks/useCartStore";
import BouquetIllustration from "../../components/BouquetIllustration";
import { formatMoney } from "../../lib/currency";
import { deliveryDateBounds, validDeliveryDate } from "../../lib/delivery-date";
import { checkoutDetailsSchema } from "../../lib/checkout-validation";

const fmt = formatMoney;

type SavedAddress = {
  id: string; label?: string | null; line1: string; line2?: string | null;
  city: string; zip?: string | null; phone?: string | null; isDefault: boolean;
};

export default function CheckoutPage() {
  const router = useRouter();
  const lines = useCartStore((s) => s.lines);
  const subtotal = useCartStore((s) => s.subtotal);
  const deliveryOptions = useCartStore((s) => s.deliveryOptions);
  const defaultFee = useCartStore((s) => s.deliveryFee);
  const clear = useCartStore((s) => s.clear);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [deliveryDate, setDeliveryDate] = useState("");
  const deliveryFee = deliveryOptions.date ?? defaultFee;
  const total = subtotal + deliveryFee;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const dateBounds = deliveryDateBounds();

  const [form, setForm] = useState({
    email: "", name: "", phone: "",
    recipient: "",
    addressLine1: "", addressLine2: "", city: "", zip: "",
    giftMessage: "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // Signed-in customers get their saved addresses offered as one-tap fill.
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  useEffect(() => {
    let active = true;
    fetch("/api/account/addresses", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active || !d?.addresses?.length) return;
        setSavedAddresses(d.addresses);
        const def = d.addresses.find((a: SavedAddress) => a.isDefault) || d.addresses[0];
        if (def) fillFromAddress(def);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  function fillFromAddress(a: SavedAddress) {
    setForm((f) => ({
      ...f,
      addressLine1: a.line1,
      addressLine2: a.line2 || "",
      city: a.city,
      zip: a.zip || "",
      phone: a.phone || f.phone,
    }));
  }

  function continueToDetails() {
    if (!validDeliveryDate(deliveryDate)) {
      setError("Choose a delivery date between tomorrow and 30 days from now.");
      return;
    }
    setError(null);
    setStep(2);
  }

  function continueToReview() {
    const result = checkoutDetailsSchema.safeParse({
      ...form,
      recipientPhone: form.phone,
    });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) errors[String(issue.path[0])] = issue.message;
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setError(null);
    setStep(3);
  }

  if (lines.length === 0) {
    return (
      <main className="fs-checkout fs-checkout--empty">
        <BouquetIllustration palette={["#e8c8b9","#cdd9bd","#efe2c7","#f5b8c4"]} className="fs-empty-img" />
        <h2 className="font-serif text-4xl">Your basket is empty.</h2>
        <button className="fs-btn fs-btn--dark" onClick={() => router.push("/list")}>Find a bouquet</button>
      </main>
    );
  }

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (!validDeliveryDate(deliveryDate)) throw new Error("Please choose a valid delivery date");
      const res = await fetch("/api/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recipientName: form.recipient || form.name,
          recipientPhone: form.phone,
          addressLine1: form.addressLine1,
          addressLine2: form.addressLine2 || undefined,
          city: form.city,
          zip: form.zip,
          country: "IL",
          delivery: "date",
          deliveryDate,
          giftMessage: form.giftMessage || undefined,
          email: form.email,
          name: form.name,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "Could not place order");
      }
      const data = await res.json();
      await clear();
      router.push(`/success?code=${encodeURIComponent(data.code)}`);
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="fs-checkout">
      <div className="fs-checkout-head">
        <h1>Checkout</h1>
        <ol className="fs-steps">
          {["Delivery", "Details", "Review"].map((label, i) => {
            const n = (i + 1) as 1 | 2 | 3;
            return (
              <li key={n} className={"fs-step" + (step === n ? " fs-step--on" : "") + (step > n ? " fs-step--done" : "")}>
                <span className="fs-step-num">{step > n ? "✓" : n}</span>
                <span className="fs-step-label">{label}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="fs-checkout-body">
        <div className="fs-checkout-form">
          {step === 1 && (
            <section className="fs-form-section">
              <h3>Delivery date</h3>
              <label style={{ display: "block", marginBottom: 16 }}>
                <span>Pick a date</span>
                <input type="date" value={deliveryDate} min={dateBounds.min} max={dateBounds.max}
                  onChange={(e) => setDeliveryDate(e.target.value)} required aria-invalid={!!error} />
              </label>
              <p>We will contact you soon to confirm delivery and payment.</p>
              {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
              <button className="fs-btn fs-btn--dark fs-btn--block" onClick={continueToDetails}>
                Continue to details →
              </button>
            </section>
          )}

          {step === 2 && (
            <section className="fs-form-section">
              <h3>Who&apos;s it from, and to</h3>
              {savedAddresses.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                  {savedAddresses.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="fs-chip"
                      onClick={() => fillFromAddress(a)}
                      title={[a.line1, a.city].filter(Boolean).join(", ")}
                    >
                      {a.label || a.line1}{a.isDefault ? " · default" : ""}
                    </button>
                  ))}
                </div>
              )}
              <div className="fs-form-grid">
                <label><span>Your email *</span><input type="email" required aria-invalid={!!fieldErrors.email} value={form.email} onChange={set("email")} placeholder="for the receipt" />{fieldErrors.email && <small role="alert">{fieldErrors.email}</small>}</label>
                <label><span>Your name *</span><input required aria-invalid={!!fieldErrors.name} value={form.name} onChange={set("name")} placeholder="Anna" />{fieldErrors.name && <small role="alert">{fieldErrors.name}</small>}</label>
                <label><span>Phone *</span><input type="tel" required aria-invalid={!!fieldErrors.recipientPhone} value={form.phone} onChange={set("phone")} placeholder="Phone number" />{fieldErrors.recipientPhone && <small role="alert">{fieldErrors.recipientPhone}</small>}</label>
                <label><span>Recipient</span><input value={form.recipient} onChange={set("recipient")} placeholder="Same as me / their name" /></label>
                <label className="fs-form-grid-wide"><span>Delivery address *</span><input required aria-invalid={!!fieldErrors.addressLine1} value={form.addressLine1} onChange={set("addressLine1")} placeholder="Street and number" />{fieldErrors.addressLine1 && <small role="alert">{fieldErrors.addressLine1}</small>}</label>
                <label><span>Apt / floor</span><input value={form.addressLine2} onChange={set("addressLine2")} /></label>
                <label><span>City *</span><input required aria-invalid={!!fieldErrors.city} value={form.city} onChange={set("city")} />{fieldErrors.city && <small role="alert">{fieldErrors.city}</small>}</label>
                <label><span>Postal code *</span><input required aria-invalid={!!fieldErrors.zip} value={form.zip} onChange={set("zip")} />{fieldErrors.zip && <small role="alert">{fieldErrors.zip}</small>}</label>
                <label className="fs-form-grid-wide"><span>Card message <em>(handwritten in fountain pen)</em></span>
                  <textarea rows={3} maxLength={160} value={form.giftMessage} onChange={set("giftMessage")} />
                </label>
              </div>
              <div className="fs-form-actions">
                <button className="fs-btn fs-btn--ghost" onClick={() => setStep(1)}>← Back</button>
                <button className="fs-btn fs-btn--dark" onClick={continueToReview}>Review order →</button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="fs-form-section">
              <h3>Final look</h3>
              <p style={{ color: "var(--fs-ink-mute)", fontSize: 14, marginTop: -8 }}>
                We&apos;ll contact you soon to confirm delivery and payment after the studio accepts your order.
              </p>
              <div className="fs-form-grid">
                <label><span>From</span><div className="border border-[var(--fs-line)] rounded-xl px-4 py-3 bg-bg-card">{form.name || "—"}<br/><small className="text-ink-mute">{form.email}</small></div></label>
                <label><span>To</span><div className="border border-[var(--fs-line)] rounded-xl px-4 py-3 bg-bg-card">{form.recipient || form.name || "—"}<br/><small className="text-ink-mute">{form.addressLine1}, {form.city}, {form.zip}</small></div></label>
                <label><span>Delivery</span><div className="border border-[var(--fs-line)] rounded-xl px-4 py-3 bg-bg-card">{deliveryDate}</div></label>
                {form.giftMessage && (
                  <label className="fs-form-grid-wide"><span>Card</span>
                    <div className="border border-[var(--fs-line)] rounded-xl px-4 py-3 bg-bg-card font-serif italic">&ldquo;{form.giftMessage}&rdquo;</div>
                  </label>
                )}
              </div>
              {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</div>}
              <div className="fs-form-actions">
                <button className="fs-btn fs-btn--ghost" onClick={() => setStep(2)}>← Back</button>
                <button className="fs-btn fs-btn--dark" onClick={submit} disabled={submitting}>
                  {submitting ? "Placing…" : `Place order · ${fmt(total)}`}
                </button>
              </div>
            </section>
          )}
        </div>

        <aside className="fs-checkout-summary">
          <h4>Your basket</h4>
          <div className="fs-summary-list">
            {lines.map((c) => (
              <div className="fs-summary-item" key={c.id}>
                <div className="fs-summary-img" style={{ background: `linear-gradient(135deg, ${c.palette[0]}33, ${c.palette[1]}33)` }}>
                  <BouquetIllustration palette={c.palette} seed={c.id.charCodeAt(0)} />
                  <span className="fs-summary-qty">{c.qty}</span>
                </div>
                <div className="fs-summary-body">
                  <div className="fs-summary-row"><b>{c.productName}</b><span>{fmt(c.total)}</span></div>
                  <span className="fs-summary-meta">{c.variantLabel || "Standard"}{c.addVase ? " · vase" : ""}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="fs-summary-totals">
            <div><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            <div><span>Delivery</span><span>{deliveryFee ? fmt(deliveryFee) : "free"}</span></div>
            <div className="fs-summary-grand"><span>Total</span><span>{fmt(total)}</span></div>
          </div>
          <p className="fs-summary-trust">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 10l3 3 7-7"/><circle cx="10" cy="10" r="9"/></svg>
            Freshness guaranteed for 7 days, on us.
          </p>
        </aside>
      </div>
    </main>
  );
}

