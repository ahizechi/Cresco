// Projects the saved ledger into the Finance page's rows.
import {
  balance,
  occurrences,
  type FinanceData,
} from "../../features/finance/model";
import { TODAY } from "../core/dates";
import { dayMonthText, monthText } from "../core/format";
import type { ViewState } from "../core/view";

const title = (text: string) => text[0].toUpperCase() + text.slice(1);

export function hydrateFinance(view: ViewState, data: FinanceData) {
  const month = TODAY.slice(0, 7);
  view.accounts = data.accounts.map((a) => ({
    id: a.id,
    name: a.name,
    inst: a.bank,
    type: a.kind === "credit" ? "Credit card" : title(a.kind),
    cur: a.currency,
    bal: balance(data, a),
    source: a.id.startsWith("bank-") ? "CSV import" : "Manual",
    synced: "",
    reconciled: a.reconciledAt || "",
    archived: a.archived,
    inNet: a.includeInTotals !== false,
  }));
  view.txns = data.transactions.map((x) => ({
    id: x.id,
    date: x.date,
    merchant: x.description,
    cat: x.category,
    categorySource: x.categorySource,
    suggestedReview: x.suggestedReview === "unsure" ? "unsure" : undefined,
    acct: x.accountId,
    amt: x.amount,
    kind: x.kind,
    status: x.status === "posted" ? "cleared" : "pending",
    source:
      x.source === "bank"
        ? "CSV import"
        : x.source === "csv"
          ? "CSV import"
          : "Manual",
    note: x.note,
    importId: x.batchId ?? null,
    transfer: x.transferId ?? null,
  }));
  view.budgets = data.budgets
    .filter((b) => b.month === month)
    .map((b) => ({ cat: b.category, limit: b.limit, roll: false }));
  view.goals = data.goals.map((g) => ({
    id: g.id,
    name: g.name,
    icon: "target",
    tone: "green",
    target: g.target,
    saved: g.saved,
    by: g.deadline,
    acct: g.accountId,
  }));
  const upcoming = occurrences(
    data,
    data.recurring.reduce(
      (first, item) => (item.start < first ? item.start : first),
      TODAY,
    ),
    `${Number(TODAY.slice(0, 4)) + 5}-12-31`,
  );
  view.schedules = data.recurring.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind === "income" ? "income" : "bill",
    amt: Math.abs(r.amount),
    freq: title(r.frequency),
    next: upcoming.find((due) => due.item.id === r.id)?.date ?? "",
    start: r.start,
    end: r.end,
    paused: r.paused,
    acct: r.accountId,
    cat: r.category,
  }));
  view.imports = data.imports.map((i) => ({
    id: i.id,
    when: dayMonthText(i.importedAt),
    source: i.name,
    accountId: i.accountId,
    duplicateCount: i.duplicateCount,
    importedAt: i.importedAt,
    count: i.count,
    status: i.status ?? "applied",
  }));
  // Linked banks come from the bank link dialog in this session, not the ledger.
  const months = Array.from({ length: 5 }, (_, index) => {
    const date = new Date(`${month}-01T12:00:00`);
    date.setMonth(date.getMonth() - (5 - index));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
  const gbp = new Set(
    data.accounts.filter((a) => a.currency === "GBP").map((a) => a.id),
  );
  const posted = (m: string, kind: "income" | "expense") =>
    data.transactions.filter(
      (row) =>
        row.date.startsWith(m) &&
        row.date <= TODAY &&
        row.status === "posted" &&
        row.kind === kind &&
        gbp.has(row.accountId),
    );
  view.cashflow = {
    labels: [...months, month].map((m) => monthText(m, true)),
    income: months.map((m) =>
      posted(m, "income").reduce((sum, row) => sum + row.amount, 0),
    ),
    spend: months.map((m) =>
      posted(m, "expense").reduce((sum, row) => sum - row.amount, 0),
    ),
  };
}
