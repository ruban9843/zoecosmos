const shopDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function deliveryDateBounds(now = new Date()) {
  const parts = shopDateFormatter.formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const today = new Date(Date.UTC(Number(value("year")), Number(value("month")) - 1, Number(value("day"))));
  const dateAfter = (days: number) => {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  };
  return { min: dateAfter(1), max: dateAfter(30) };
}

export function validDeliveryDate(value: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  const { min, max } = deliveryDateBounds(now);
  return value >= min && value <= max;
}