/** Locale-aware dates in the UI language ("12 Oct 2026" / "12 באוק׳ 2026"). */
export const formatDate = (value: string | Date, lng: string) =>
  new Intl.DateTimeFormat(lng, { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "3 days ago" / "לפני 3 ימים". */
export const formatRelative = (value: string | Date, lng: string, now = Date.now()) => {
  const seconds = (new Date(value).getTime() - now) / 1000;
  const rtf = new Intl.RelativeTimeFormat(lng, { numeric: "auto" });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(0, "minute");
};
