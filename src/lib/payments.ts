/**
 * Payment gateway integration point. Checkout and the webhook route only talk
 * to `payments`; swap `manualProvider` for a real gateway adapter later.
 */
export type PaymentOrder = { id: string; code: string; total: number; currency: string };
export type PaymentInit = { ref: string | null; redirectUrl: string | null };
export type PaymentEvent = { ref: string; status: "PAID" | "FAILED" | "REFUNDED" };

export interface PaymentProvider {
  name: string;
  createPayment(order: PaymentOrder): Promise<PaymentInit>;
  /** Verify the gateway signature and return the event, or null if it isn't valid. */
  parseWebhook(req: Request): Promise<PaymentEvent | null>;
}

/** Today's behaviour: no online payment; staff mark orders paid in the admin. */
const manualProvider: PaymentProvider = {
  name: "manual",
  async createPayment() {
    return { ref: null, redirectUrl: null };
  },
  async parseWebhook() {
    return null;
  },
};

export const payments: PaymentProvider = manualProvider;
