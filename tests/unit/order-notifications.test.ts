import { afterEach, describe, expect, it, vi } from "vitest";
import { notifyNewOrder, notifyOrderStatus, openMailTransport } from "../../src/lib/order-notifications";

type NotificationOrder = Parameters<typeof notifyNewOrder>[0];
const order = {
  code: "FS-12345", status: "NEW", contactEmail: "customer@example.com", customerName: "Customer",
  recipientName: "Recipient", recipientPhone: "1234567890", addressLine1: "1 Flower Street",
  addressLine2: null, city: "Chennai", zip: "600001", country: "IN",
  deliveryDate: new Date("2026-11-19T00:00:00Z"), subtotal: 10000, deliveryFee: 2000, total: 12000,
  items: [{ productName: "Flowers", variantLabel: null, qty: 1, total: 10000 }],
} as NotificationOrder;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("order notifications", () => {
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

  it("sends confirmation and deduplicated administrator alerts", async () => {
    vi.stubEnv("OWNER_EMAIL", "owner@example.com");
    vi.stubEnv("ADMIN_EMAIL", "OWNER@example.com");
    const send = vi.fn().mockResolvedValue(undefined);
    await notifyNewOrder(order, send);
    expect(send.mock.calls.map(([email]) => email.to)).toEqual(["customer@example.com", "owner@example.com"]);
    expect(send.mock.calls[0][0].text).toContain("Flowers x 1");
    expect(send.mock.calls[1][0].text).toContain("customer@example.com");
  });

  it("uses the checkout email for relevant status changes and the account for older orders", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    await notifyOrderStatus({ ...order, status: "TYING", user: { email: "account@example.com" } }, "NEW", send);
    await notifyOrderStatus({ ...order, status: "OUT_FOR_DELIVERY", contactEmail: null, user: { email: "account@example.com" } }, "READY", send);
    await notifyOrderStatus({ ...order, status: "TYING" }, "TYING", send);
    await notifyOrderStatus({ ...order, status: "READY" }, "TYING", send);
    expect(send.mock.calls.map(([email]) => email.to)).toEqual(["customer@example.com", "account@example.com"]);
  });

  it("continues notifying others when a transport fails", async () => {
    vi.stubEnv("OWNER_EMAIL", "owner@example.com");
    vi.stubEnv("ADMIN_EMAIL", "admin@example.com");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const send = vi.fn().mockRejectedValueOnce(new Error("unavailable")).mockResolvedValue(undefined);
    await expect(notifyNewOrder(order, send)).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(3);
  });
});