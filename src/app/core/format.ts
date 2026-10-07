// Shared number, money and date text. Amounts are integer minor units
// (pence/cents); every locale-dependent string is produced here, in en-GB.
const LOCALE = "en-GB";

export type ClassValue = string | false | null | undefined | 0;
export const cx = (...names: ClassValue[]) => names.filter(Boolean).join(" ");
export const pad = (n: number) => String(n).padStart(2, "0");
export const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));

export const SYM: Record<string, string> = { GBP: "£", USD: "$", EUR: "€" };

export interface MoneyOptions {
  cur?: string;
  whole?: boolean;
  sign?: boolean;
}

/** Formats minor units as a currency amount, e.g. −£12.50. */
export function money(minor: number, options: MoneyOptions = {}): string {
  const cur = options.cur || "GBP";
  const digits = options.whole ? 0 : 2;
  const text = (Math.abs(minor) / 100).toLocaleString(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  const body = SYM[cur] ? SYM[cur] + text : text + " " + cur;
  return (minor < 0 ? "−" : options.sign && minor > 0 ? "+" : "") + body;
}

/** Compact axis label for minor units, e.g. £1.25k. */
export function moneyAxis(minor: number, cur = "GBP"): string {
  const symbol = SYM[cur] || "";
  const major = Math.abs(minor) / 100;
  const text =
    major >= 1000
      ? +(major / 1000).toFixed(major % 1000 ? 2 : 0) + "k"
      : Math.round(major).toString();
  return (minor < 0 ? "−" : "") + symbol + text;
}

export const pct = (value: number, digits = 1) =>
  (value > 0 ? "+" : value < 0 ? "−" : "") +
  Math.abs(value).toFixed(digits) +
  "%";

export const num = (value: number, digits = 0) =>
  value.toLocaleString(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

/** Parses a typed amount such as "£1,250.50" into minor units. */
export const parseMoney = (text: string | number): number | null => {
  const value = parseFloat(String(text).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(value) ? Math.round(value * 100) : null;
};

type Instant = string | number | Date;

/** Date and time a source reported, e.g. 24/09/2026, 14:01:05. */
export const dateTimeText = (at: Instant) =>
  new Date(at).toLocaleString(LOCALE);

/** Clock time, e.g. 14:01:05, or 14:01 without seconds. */
export const timeText = (at: Instant, seconds = true) =>
  new Date(at).toLocaleTimeString(
    LOCALE,
    seconds ? undefined : { hour: "2-digit", minute: "2-digit" },
  );

/** Day and short month, e.g. 24 Sep; empty for a missing or invalid time. */
export const dayMonthText = (at: Instant | null | undefined) =>
  at != null && at !== "" && Number.isFinite(new Date(at).getTime())
    ? new Date(at).toLocaleDateString(LOCALE, {
        day: "numeric",
        month: "short",
      })
    : "";

/** Full date, e.g. 31 Jan 2028. */
export const fullDateText = (at: Instant) =>
  new Date(at).toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** Compact date in the current year, with a year when older or ahead. */
export const shortDateText = (at: Instant) => {
  const date = new Date(at);
  if (!Number.isFinite(date.getTime())) return "";
  const dayMonth = dayMonthText(date).replace("Sept", "Sep");
  return date.getFullYear() === new Date().getFullYear()
    ? dayMonth
    : `${dayMonth} ${date.getFullYear()}`;
};

export const shortDateTimeText = (at: Instant) => {
  const date = new Date(at);
  if (!Number.isFinite(date.getTime())) return "";
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return `${sameDay ? "Today" : shortDateText(date)} ${timeText(date, false)}`;
};

/** A YYYY-MM month as "September 2026", or "Sep" when short. */
export const monthText = (month: string, short = false) =>
  new Date(`${month}-01T12:00:00`).toLocaleDateString(
    LOCALE,
    short ? { month: "short" } : { month: "long", year: "numeric" },
  );
