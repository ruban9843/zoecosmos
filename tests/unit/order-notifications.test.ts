import { afterEach, describe, expect, it, vi } from "vitest";
import { dailyDigestEmails, newOrderEmails, openMailTransport, statusEmail } from "../../src/lib/order-notifications";

type NotificationOrder = Parameters<typeof newOrderEmails>[0];
const order = {
  code: "FS-12345", status: "NEW", contactEmail: "customer@example.com", customerName: "Customer",
  recipientName: "Recipient", recipientPhone: "1234567890", addressLine1: "1 Flower Street",
  addressLine2: null, city: "Chennai", zip: "600001", country: "IN",
  deliveryDate: new Date("2026-11-19T00:00:00Z"), subtotal: 10000, deliveryFee: 2000, total: 12000,
  items: [{ productName: "Flowers <b>", variantLabel: null, qty: 1, total: 10000, imageUrl: "https://cdn.example.com/p.webp" }],
} as unknown as NotificationOrder;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("OpenMail transport", () => {
  it("sends through OpenMail using the configured inbox", async () => {
    vi.stubEnv("OPENMAIL_API_KEY", "test-key");
    vi.stubEnv("OPENMAIL_INBOX_ID", "test-inbox");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "sent" }) });
    vi.stubGlobal("fetch", fetchMock);
    await openMailTransport({ to: "customer@example.com", subject: "Order", text: "Thank you" });
    expect(fetchMock).toHaveBeenCalledWith("https://api.openmail.sh/v1/inboxes/test-inbox/send", expect.objectContaining({
      method: "POST",
      headers: { Authorization: "Bearer test-key", "Content-Type": "application/json" },
      body: JSON.stringify({ to: "customer@example.com", subject: "Order", body: "Thank you" }),
    }));
  });

  it("passes HTML and an idempotency key when given", async () => {
    vi.stubEnv("OPENMAIL_API_KEY", "test-key");
    vi.stubEnv("OPENMAIL_INBOX_ID", "test-inbox");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "sent" }) });
    vi.stubGlobal("fetch", fetchMock);
    await openMailTransport({ to: "c@example.com", subject: "S", text: "T", html: "<p>T</p>", idempotencyKey: "status:FS-1:TYING" });
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers["Idempotency-Key"]).toBe("status:FS-1:TYING");
    expect(JSON.parse(init.body)).toEqual({ to: "c@example.com", subject: "S", body: "T", bodyHtml: "<p>T</p>" });
  });

  it("rejects OpenMail errors or missing configuration", async () => {
    vi.stubEnv("OPENMAIL_API_KEY", "");
    await expect(openMailTransport({ to: "customer@example.com", subject: "Order", text: "Thank you" })).rejects.toThrow("not configured");
    vi.stubEnv("OPENMAIL_API_KEY", "test-key");
    vi.stubEnv("OPENMAIL_INBOX_ID", "test-inbox");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    await expect(openMailTransport({ to: "customer@example.com", subject: "Order", text: "Thank you" })).rejects.toThrow("429");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "failed" }) }));
    await expect(openMailTransport({ to: "customer@example.com", subject: "Order", text: "Thank you" })).rejects.toThrow("failed send");
  });
});

describe("order email builders", () => {
  it("builds a confirmation and deduplicated administrator alerts", () => {
    vi.stubEnv("OWNER_EMAIL", "owner@example.com");
    vi.stubEnv("ADMIN_EMAIL", "OWNER@example.com");
    const emails = newOrderEmails(order);
    expect(emails.map((e) => e.to)).toEqual(["customer@example.com", "owner@example.com"]);
    expect(emails[0].kind).toBe("ORDER_PLACED_CUSTOMER");
    expect(emails[0].text).toContain("team will contact you");
    expect(emails[0].text).toContain("Flowers <b> x 1");
    expect(emails[1].text).toContain("customer@example.com");
    expect(new Set(emails.map((e) => e.dedupeKey)).size).toBe(emails.length);
  });

  it("includes the product image and escapes HTML in the customer email", () => {
    const [customer] = newOrderEmails(order);
    expect(customer.html).toContain('src="https://cdn.example.com/p.webp"');
    expect(customer.html).toContain("Flowers &lt;b&gt;");
    expect(customer.html).not.toContain("Flowers <b>");
  });

  it("emails only on entering Tying or Out for delivery, using the account email for older orders", () => {
    const tying = statusEmail({ ...order, status: "TYING", user: { email: "account@example.com" } }, "NEW");
    const out = statusEmail({ ...order, status: "OUT_FOR_DELIVERY", contactEmail: null, user: { email: "account@example.com" } }, "READY");
    expect(tying?.to).toBe("customer@example.com");
    expect(tying?.kind).toBe("STATUS_TYING");
    expect(tying?.dedupeKey).toBe("status:FS-12345:TYING");
    expect(out?.to).toBe("account@example.com");
    expect(out?.html).toContain("cdn.example.com");
    expect(statusEmail({ ...order, status: "TYING" }, "TYING")).toBeNull();
    expect(statusEmail({ ...order, status: "READY" }, "TYING")).toBeNull();
    expect(statusEmail({ ...order, status: "DELIVERED" }, "OUT_FOR_DELIVERY")).toBeNull();
  });

  it("skips status emails when there is no address", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(statusEmail({ ...order, status: "TYING", contactEmail: null, user: null }, "NEW")).toBeNull();
  });

  it("builds one digest per admin per day, and none for an empty day", () => {
    vi.stubEnv("OWNER_EMAIL", "owner@example.com");
    vi.stubEnv("ADMIN_EMAIL", "admin@example.com");
    const digest = dailyDigestEmails([order, { ...order, code: "FS-22222" }], "2026-11-19");
    expect(digest.map((e) => e.dedupeKey)).toEqual(["digest:2026-11-19:owner@example.com", "digest:2026-11-19:admin@example.com"]);
    expect(digest[0].text).toContain("FS-12345");
    expect(digest[0].text).toContain("FS-22222");
    expect(dailyDigestEmails([], "2026-11-19")).toEqual([]);
  });
});
