// Finance figures derived from the view: categories, account names, monthly
// totals, budget progress, cash history and what needs attention.
import { sampleMode } from "@sample";
import { TODAY, addDays, toD } from "../core/dates";
import { money, monthText } from "../core/format";
import { S, go, openDialog } from "../core/state";
import type { IconName } from "../ui/icons";
import type { AccountRow, BudgetRow, TxnRow } from "../core/view";
import { merchantKey } from "../../features/finance/merchants";

export const CATS: Record<string, { i: IconName; tone: string | null }> = {
  Groceries: { i: "shopping-cart", tone: "green" },
  Transport: { i: "bus", tone: "blue" },
  "Eating out": { i: "utensils", tone: "orange" },
  Bills: { i: "zap", tone: "amber" },
  Fees: { i: "receipt-text", tone: "rose" },
  Home: { i: "house", tone: "blue" },
  Subscriptions: { i: "repeat", tone: "teal" },
  Shopping: { i: "shopping-bag", tone: "rose" },
  Entertainment: { i: "film", tone: "teal" },
  Health: { i: "heart-pulse", tone: "rose" },
  Gifts: { i: "gift", tone: "amber" },
  Travel: { i: "plane", tone: "blue" },
  Education: { i: "list", tone: "teal" },
  Business: { i: "briefcase", tone: "violet" },
  Income: { i: "briefcase", tone: "green" },
  Salary: { i: "banknote", tone: "green" },
  "Other income": { i: "coins", tone: "green" },
  Transfer: { i: "arrow-left-right", tone: null },
  Uncategorised: { i: "circle-dashed", tone: null },
};

export const SPEND_CATS = [
  "Groceries",
  "Transport",
  "Eating out",
  "Bills",
  "Fees",
  "Home",
  "Subscriptions",
  "Shopping",
  "Entertainment",
  "Health",
  "Gifts",
  "Travel",
  "Education",
  "Business",
];

/** Categories a transaction can be moved to from a menu. */
export const MOVE_CATS = [
  ...SPEND_CATS,
  "Income",
  "Salary",
  "Other income",
  "Uncategorised",
];

export const catColor = (cat: string) =>
  CATS[cat]?.tone ? `var(--t-${CATS[cat].tone})` : "var(--fg-subtle)";

export const acct = (id: string | null | undefined): AccountRow | undefined =>
  S.accounts.find((a) => a.id === id);

export const acctName = (id: string | null | undefined) => {
  const a = acct(id);
  return a
    ? a.inst === "Manual" || a.name.startsWith(a.inst)
      ? a.name
      : a.inst + " " + a.name
    : "—";
};

/**
 * The other account of a transfer. Sample rows name it directly; saved rows
 * share a pair id with the other side.
 */
export function transferAccount(t: TxnRow): AccountRow | undefined {
  if (!t.transfer) return undefined;
  if (sampleMode) return acct(t.transfer);
  const peer = S.txns.find(
    (row) => row.id !== t.id && row.transfer === t.transfer,
  );
  return acct(peer?.acct);
}

export const thisMonth = () => TODAY.slice(0, 7);
export const lastMonth = () => addDays(`${thisMonth()}-01`, -1).slice(0, 7);
export const monthName = (month = thisMonth()) =>
  monthText(month).split(" ")[0];

/** Days left in this month after today. */
export function daysLeftInMonth() {
  const today = toD(TODAY);
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return last.getDate() - today.getDate();
}

export const monthTx = (month = thisMonth()) =>
  S.txns.filter((t) => t.date.startsWith(month));

/** Whether a row counts toward GBP totals: saved rows must be posted and dated. */
const counts = (t: TxnRow) =>
  sampleMode ||
  (t.status !== "pending" && t.date <= TODAY && acct(t.acct)?.cur === "GBP");

export type FinancePeriod = "month" | "previous" | "six" | "all";
export const periodLabel: Record<FinancePeriod, string> = {
  month: "This month",
  previous: "Last month",
  six: "Last 6 months",
  all: "All dates",
};
export function periodRows(period: FinancePeriod): TxnRow[] {
  const first = toD(`${thisMonth()}-01`);
  first.setMonth(first.getMonth() - 5);
  const sixStart = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, "0")}`;
  return S.txns.filter(
    (t) =>
      counts(t) &&
      (period === "all" ||
        (period === "month" && t.date.startsWith(thisMonth())) ||
        (period === "previous" && t.date.startsWith(lastMonth())) ||
        (period === "six" && t.date.slice(0, 7) >= sixStart)),
  );
}

export function periodBreakdown(period: FinancePeriod) {
  const spending: Record<string, number> = {};
  const income: Record<string, number> = {};
  for (const t of periodRows(period)) {
    if (t.transfer) continue;
    if (t.kind === "expense") spending[t.cat] = (spending[t.cat] || 0) - t.amt;
    if (t.kind === "income")
      income[t.merchant] = (income[t.merchant] || 0) + t.amt;
  }
  return { spending, income };
}

export function spentByCat(month = thisMonth()): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of monthTx(month))
    if (t.kind === "expense" && !t.transfer && counts(t))
      out[t.cat] = (out[t.cat] || 0) - t.amt;
  return out;
}

export const totalSpent = (month?: string) =>
  Object.values(spentByCat(month)).reduce((a, b) => a + b, 0);

const incomeRows = (month?: string) =>
  monthTx(month).filter((t) => t.kind === "income" && !t.transfer && counts(t));

export const totalIncome = (month?: string) =>
  incomeRows(month).reduce((a, t) => a + t.amt, 0);

/** This month's income by who paid it. */
export function incomeBySource(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of incomeRows())
    out[t.merchant] = (out[t.merchant] || 0) + t.amt;
  return out;
}

/** Posted GBP current and savings balances; pending entries don't move them. */
export const cashAccts = () =>
  S.accounts.filter(
    (a) =>
      !a.archived &&
      a.inNet &&
      a.cur === "GBP" &&
      (a.type === "Current" || a.type === "Savings"),
  );

export interface BudgetProgress extends BudgetRow {
  spent: number;
}
export function budgetRows(): BudgetProgress[] {
  const spent = spentByCat();
  return S.budgets.map((b) => ({ ...b, spent: spent[b.cat] || 0 }));
}

/** Cash balance at the end of each of the last `days` days, oldest first. */
export function cashHistory(days = 30) {
  const accounts = cashAccts();
  const ids = accounts.map((a) => a.id);
  let bal = accounts.reduce((s, a) => s + a.bal, 0);
  const out = [bal];
  for (let i = 0; i < days; i++) {
    const day = addDays(TODAY, -i);
    bal -= S.txns
      .filter(
        (t) => t.date === day && ids.includes(t.acct) && t.status !== "pending",
      )
      .reduce((s, t) => s + t.amt, 0);
    out.unshift(bal);
  }
  return out;
}

/** Budgeted spending this month, cumulative by day; null after today. */
export function budgetPace() {
  const month = thisMonth();
  const length = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0,
  ).getDate();
  const days = Array.from({ length }, (_, i) => i + 1);
  let total = 0;
  const values = days.map((d) => {
    const day = `${month}-${String(d).padStart(2, "0")}`;
    if (day > TODAY) return null;
    total += S.txns
      .filter(
        (t) =>
          t.date === day &&
          t.amt < 0 &&
          !t.transfer &&
          S.budgets.some((b) => b.cat === t.cat),
      )
      .reduce((a, t) => a - t.amt, 0);
    return total;
  });
  return { days, values };
}

/** Transaction ids to delete: the selection plus the other side of transfers. */
export function sampleDeleteIds(rows: TxnRow[], selected: string[]) {
  const ids = new Set(selected);
  for (const id of selected) {
    const row = rows.find((item) => item.id === id);
    if (!row?.transfer) continue;
    const other = rows.find(
      (item) =>
        item.id !== id &&
        ((item.transfer === row.transfer && item.acct !== row.acct) ||
          (item.acct === row.transfer && item.transfer === row.acct)) &&
        item.date === row.date &&
        item.amt === -row.amt,
    );
    if (other) ids.add(other.id);
  }
  return ids;
}

export interface Attention {
  k: string;
  i: IconName;
  text: string;
  act: string;
  f: () => void;
}
export function financeAttention(): Attention[] {
  const uncategorised = S.txns.filter(
    (t) =>
      t.cat === "Uncategorised" &&
      (t.kind === "expense" || t.kind === "income"),
  ).length;
  return [
    ...(uncategorised
      ? [
          {
            k: "uncategorised",
            i: "circle-dashed" as const,
            text: `${uncategorised} transactions need categories; breakdowns and budgets are incomplete`,
            act: "Review",
            f: () => go("finance", "transactions"),
          },
        ]
      : []),
    ...S.txns
      .filter((t) => t.status === "pending")
      .map((t): Attention => ({
        k: t.id,
        i: "clock",
        text: `${t.merchant} ${money(t.amt)} is pending`,
        act: "Review",
        f: () => go("finance", "transactions"),
      })),
    ...S.banks
      .filter((b) => b.status === "renew")
      .map((b): Attention => ({
        k: b.id,
        i: "landmark",
        text: `${b.bank} access ends ${b.expires}`,
        act: "Renew",
        f: () => openDialog("account"),
      })),
    ...budgetRows()
      .filter((b) => b.spent > b.limit)
      .map((b): Attention => ({
        k: b.cat,
        i: "triangle-alert",
        text: `${b.cat} is ${money(b.spent - b.limit)} over budget`,
        act: "Adjust",
        f: () =>
          openDialog("budget", { b: S.budgets.find((x) => x.cat === b.cat) }),
      })),
  ];
}

/** Whole months until a day, at least one. */
export const monthsUntil = (day: string) =>
  Math.max(
    1,
    Math.round((toD(day).getTime() - toD(TODAY).getTime()) / (864e5 * 30.4)),
  );

export const daysUntil = (day: string) =>
  Math.round((toD(day).getTime() - toD(TODAY).getTime()) / 864e5);

/** Merchants with an unsure Suggested pick. One Keep clears a merchant, so attention
 * counts merchants rather than their rows. */
export function unsureMerchants(rows: TxnRow[] = S.txns): number {
  return new Set(
    rows
      .filter((row) => row.suggestedReview === "unsure")
      .map((row) => `${row.kind}:${merchantKey(row.merchant)}:${row.cat}`),
  ).size;
}
