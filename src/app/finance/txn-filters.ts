// Filtering, sorting and paging for the Transactions tab.
import { sampleMode } from "@sample";
import { TODAY } from "../core/dates";
import { monthText } from "../core/format";
import type { TxnRow } from "../core/view";

export type StatusFilter =
  "all" | "cleared" | "pending" | "transfer" | "review" | "unsure";
export interface Filters {
  q: string;
  acc: string;
  cat: string;
  st: StatusFilter;
  /** YYYY-MM or "all". */
  month: string;
}
export const NO_FILTERS: Omit<Filters, "month"> = {
  q: "",
  acc: "all",
  cat: "all",
  st: "all",
};
export interface Sort {
  k: "date" | "amt";
  dir: 1 | -1;
}
export const PER_PAGE = 12;

const matchesStatus = (t: TxnRow, st: StatusFilter) =>
  st === "all" ||
  (st === "transfer"
    ? !!t.transfer
    : st === "unsure"
      ? t.suggestedReview === "unsure"
      : st === "review"
        ? t.cat === "Uncategorised"
        : t.status === st);

export function filterTxns(rows: TxnRow[], f: Filters, sort: Sort) {
  const q = f.q.toLowerCase();
  return rows
    .filter(
      (t) =>
        (f.month === "all" || t.date.startsWith(f.month)) &&
        (f.acc === "all" || t.acct === f.acc) &&
        (f.cat === "all" || t.cat === f.cat) &&
        matchesStatus(t, f.st) &&
        `${t.merchant} ${t.note} ${t.cat}`.toLowerCase().includes(q),
    )
    .sort(
      (a, b) =>
        (sort.k === "amt" ? a.amt - b.amt : a.date.localeCompare(b.date)) *
        sort.dir,
    );
}

/** Months with transactions, newest first, then all dates. */
export function monthOptions(rows: TxnRow[]) {
  const months = sampleMode
    ? ["2026-09", "2026-08"]
    : [...new Set([TODAY.slice(0, 7), ...rows.map((t) => t.date.slice(0, 7))])]
        .sort()
        .reverse();
  return [
    ...months.map((v) => ({ v, l: monthText(v) })),
    { v: "all", l: "All dates" },
  ];
}

/** Money out across rows, excluding transfers, as a positive amount. */
export const moneyOut = (rows: TxnRow[]) =>
  -rows.filter((t) => t.amt < 0 && !t.transfer).reduce((a, t) => a + t.amt, 0);
