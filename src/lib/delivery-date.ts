const shopDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * The shop's (IST) calendar day `offset` days from now, as UTC midnight —
 * the same encoding checkout uses for `Order.deliveryDate`.
 */
export function shopDay(offset = 0, now = new Date()) {
  const parts = shopDateFormatter.formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const day = new Date(Date.UTC(Number(value("year")), Number(value("month")) - 1, Number(value("day"))));
  day.setUTCDate(day.getUTCDate() + offset);
  return day;
}

export function shopDayKey(offset = 0, now = new Date()) {
  return shopDay(offset, now).toISOString().slice(0, 10);
}

/** Add calendar days (or months) to a UTC-midnight date. */
export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function addMonths(date: Date, months: number) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

export function deliveryDateBounds(now = new Date()) {
  return { min: shopDayKey(1, now), max: shopDayKey(30, now) };
}

export function validDeliveryDate(value: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  const { min, max } = deliveryDateBounds(now);
  return value >= min && value <= max;
}