export const financeTabs = [
  ["overview", "Overview"],
  ["accounts", "Accounts"],
  ["transactions", "Transactions"],
  ["spending", "Spending"],
  ["budgets", "Budgets"],
  ["recurring", "Bills & income"],
  ["networth", "Net worth"],
  ["goals", "Goals"],
  ["forecast", "Forecast"],
  ["tax", "Tax documents"],
  ["connections", "Connections"],
] as const;
export type FinanceTab = (typeof financeTabs)[number][0];
export const currencies = [
  "GBP",
  "EUR",
  "USD",
  "CHF",
  "CAD",
  "AUD",
  "PLN",
  "JPY",
  "INR",
  "SGD",
  "AED",
] as const;
export type Currency = (typeof currencies)[number];
export const categories = [
  "Uncategorised",
  "Groceries",
  "Eating out",
  "Transport",
  "Shopping",
  "Home",
  "Bills",
  "Fees",
  "Subscriptions",
  "Health",
  "Entertainment",
  "Travel",
  "Education",
  "Gifts",
  "Salary",
  "Other income",
];
export type Account = {
  id: string;
  name: string;
  bank: string;
  kind: "current" | "savings" | "credit" | "cash";
  currency: Currency;
  openingBalance: number;
  openingDate: string;
  archived: boolean;
  includeInTotals?: boolean;
  reconciledAt?: string;
};
export type Transaction = {
  id: string;
  accountId: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  categorySource?: "suggested" | "manual" | "known" | "rule";
  /** "unsure": Suggested's pick is under the threshold. "unanswered": Suggested gave no
   * usable answer, so the automatic pass skips the row until new rows arrive. */
  suggestedReview?: "unsure" | "unanswered";
  kind: "expense" | "income" | "transfer" | "adjustment";
  status: "posted" | "pending";
  note: string;
  source: "manual" | "csv" | "bank";
  importKey?: string;
  batchId?: string;
  transferId?: string;
  scheduleKey?: string;
  providerId?: string;
};
export type Budget = {
  id: string;
  month: string;
  category: string;
  currency: Currency;
  limit: number;
};
export type Recurring = {
  id: string;
  name: string;
  accountId: string;
  amount: number;
  category: string;
  kind: "expense" | "income";
  start: string;
  end: string;
  frequency: "weekly" | "monthly" | "yearly";
  paused: boolean;
};
export type Asset = {
  id: string;
  name: string;
  kind: "asset" | "liability";
  currency: Currency;
  value: number;
  date: string;
  note: string;
};
export type Goal = {
  id: string;
  name: string;
  currency: Currency;
  target: number;
  saved: number;
  accountId: string;
  deadline: string;
};
export type Rule = {
  id: string;
  contains: string;
  category: string;
  kind: "expense" | "income";
  match?: "exact";
};
export type ImportBatch = {
  id: string;
  accountId: string;
  name: string;
  importedAt: string;
  count: number;
  duplicateCount: number;
  /** Prior amounts for existing CSV rows corrected during a re-import. */
  corrections?: {
    transactionId: string;
    beforeAmount: number;
    afterAmount: number;
    beforeKind?: Transaction["kind"];
    afterKind?: Transaction["kind"];
  }[];
  status?: "applied" | "undone";
};
export type WorthSnapshot = {
  id: string;
  date: string;
  currency: Currency;
  value: number;
};
export type FinanceData = {
  schema: 1;
  revision: number;
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  recurring: Recurring[];
  assets: Asset[];
  goals: Goal[];
  rules: Rule[];
  imports: ImportBatch[];
  snapshots: WorthSnapshot[];
};
export const emptyFinance = (): FinanceData => ({
  schema: 1,
  revision: 0,
  accounts: [],
  transactions: [],
  budgets: [],
  recurring: [],
  assets: [],
  goals: [],
  rules: [],
  imports: [],
  snapshots: [],
});
export const id = () => crypto.randomUUID();
export const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
export function validDate(s: string): boolean {
  const d = new Date(`${s}T12:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    s >= "1900-01-01" &&
    s <= "2200-12-31" &&
    !Number.isNaN(d.getTime()) &&
    d.toISOString().slice(0, 10) === s
  );
}
const currencyFormats = new Map(
  currencies.map((currency) => [
    currency,
    new Intl.NumberFormat("en-GB", { style: "currency", currency }),
  ]),
);
// Storage uses integer minor units. Keep the exponent part of the data contract
// instead of deriving it from the WebView's ICU/CLDR version.
const currencyDigits: Record<Currency, number> = {
  GBP: 2,
  EUR: 2,
  USD: 2,
  CHF: 2,
  CAD: 2,
  AUD: 2,
  PLN: 2,
  JPY: 0,
  INR: 2,
  SGD: 2,
  AED: 2,
};
export const digits = (currency: Currency) => currencyDigits[currency];
export const money = (minor: number, currency: Currency = "GBP") =>
  currencyFormats
    .get(currency)!
    .format((minor === 0 ? 0 : minor) / 10 ** digits(currency));
export function parseMoney(raw: string, currency: Currency): number {
  let s = raw
    .trim()
    .replace(/[£€$¥₹]/g, "")
    .replace(/\s/g, "");
  if (/^\(.+\)$/.test(s)) s = `-${s.slice(1, -1)}`;
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(s))
    throw new Error("Enter an amount such as 1,250.50.");
  s = s.replaceAll(",", "");
  const [whole, fraction = ""] = s.replace(/^[+-]/, "").split(".");
  const precision = digits(currency);
  if (fraction.length > precision && /[1-9]/.test(fraction.slice(precision)))
    throw new Error(`${currency} supports ${precision} decimal places.`);
  const n =
    (Number(whole) * 10 ** precision +
      Number(fraction.slice(0, precision).padEnd(precision, "0"))) *
    (s.startsWith("-") ? -1 : 1);
  if (!Number.isSafeInteger(n) || Math.abs(n) > 1e14)
    throw new Error("That amount is too large.");
  return n;
}
export const inputMoney = (n: number, currency: Currency) =>
  (n / 10 ** digits(currency)).toFixed(digits(currency));
export function balance(
  data: FinanceData,
  account: Account,
  asOf = today(),
): number {
  if (asOf < account.openingDate) return 0;
  return (
    account.openingBalance +
    data.transactions
      .filter(
        (t) =>
          t.accountId === account.id &&
          t.status === "posted" &&
          t.date >= account.openingDate &&
          t.date <= asOf,
      )
      .reduce((sum, t) => sum + t.amount, 0)
  );
}
export function periodTransactions(
  data: FinanceData,
  month: string,
  currency: Currency,
) {
  const ids = new Set(
    data.accounts.filter((a) => a.currency === currency).map((a) => a.id),
  );
  return data.transactions.filter(
    (t) =>
      ids.has(t.accountId) &&
      t.status === "posted" &&
      t.date.startsWith(month) &&
      t.date <= today(),
  );
}
export function totals(transactions: Transaction[]) {
  const spent = transactions
    .filter((t) => t.kind === "expense")
    .reduce((s, t) => s + t.amount, 0);
  return {
    income: transactions
      .filter((t) => t.kind === "income")
      .reduce((s, t) => s + t.amount, 0),
    spending: spent === 0 ? 0 : -spent,
  };
}
export function categorySpend(transactions: Transaction[]) {
  const sums = new Map<string, number>();
  for (const t of transactions)
    if (t.kind === "expense")
      sums.set(t.category, (sums.get(t.category) ?? 0) - t.amount);
  return [...sums].sort((a, b) => b[1] - a[1]);
}
export function netWorth(data: FinanceData, currency: Currency) {
  return (
    data.accounts
      .filter((a) => a.currency === currency)
      .reduce((s, a) => s + balance(data, a), 0) +
    data.assets
      .filter((a) => a.currency === currency)
      .reduce((s, a) => s + (a.kind === "liability" ? -a.value : a.value), 0)
  );
}
export function addMonths(date: string, count: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + count, 1, 12));
  const last = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  first.setUTCDate(Math.min(d, last));
  return first.toISOString().slice(0, 10);
}
export function occurrenceDate(item: Recurring, n: number) {
  if (item.frequency !== "weekly")
    return addMonths(item.start, n * (item.frequency === "yearly" ? 12 : 1));
  const d = new Date(`${item.start}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n * 7);
  return d.toISOString().slice(0, 10);
}
export type Due = {
  item: Recurring;
  date: string;
  key: string;
  recorded: boolean;
};
export function occurrences(
  data: FinanceData,
  from: string,
  until: string,
  includeRecorded = false,
): Due[] {
  const paid = new Set(
    data.transactions.filter((t) => t.scheduleKey).map((t) => t.scheduleKey),
  );
  const result: Due[] = [];
  for (const item of data.recurring) {
    if (item.paused) continue;
    for (let n = 0; ; n++) {
      const date = occurrenceDate(item, n);
      if (date > until || (item.end && date > item.end)) break;
      if (date < from) continue;
      const key = `${item.id}:${date}`;
      if (includeRecorded || !paid.has(key))
        result.push({ item, date, key, recorded: paid.has(key) });
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}
export function recordOccurrence(data: FinanceData, due: Due): FinanceData {
  if (data.transactions.some((t) => t.scheduleKey === due.key))
    throw new Error("This occurrence is already recorded.");
  return {
    ...data,
    transactions: [
      ...data.transactions,
      {
        id: id(),
        accountId: due.item.accountId,
        date: due.date,
        description: due.item.name,
        amount: due.item.amount * (due.item.kind === "expense" ? -1 : 1),
        category: due.item.category,
        kind: due.item.kind,
        status: "posted",
        source: "manual",
        note: "",
        scheduleKey: due.key,
      },
    ],
  };
}
export function transfer(
  data: FinanceData,
  fromId: string,
  toId: string,
  amount: number,
  received: number,
  date: string,
): FinanceData {
  const from = data.accounts.find((a) => a.id === fromId),
    to = data.accounts.find((a) => a.id === toId);
  if (
    !from ||
    !to ||
    fromId === toId ||
    amount <= 0 ||
    received <= 0 ||
    !validDate(date)
  )
    throw new Error("Choose different accounts, a date and positive amounts.");
  if (from.currency === to.currency && amount !== received)
    throw new Error(
      "A transfer in the same currency must balance. Record fees separately.",
    );
  const transferId = id();
  const base = {
    date,
    category: "Transfer",
    kind: "transfer" as const,
    status: "posted" as const,
    source: "manual" as const,
    note: "",
    transferId,
  };
  return {
    ...data,
    transactions: [
      ...data.transactions,
      {
        ...base,
        id: id(),
        accountId: fromId,
        amount: -amount,
        description: `Transfer to ${to.name}`,
      },
      {
        ...base,
        id: id(),
        accountId: toId,
        amount: received,
        description: `Transfer from ${from.name}`,
      },
    ],
  };
}
export function forecast(
  data: FinanceData,
  currency: Currency,
  months: number,
  monthlySpending: number,
  monthlyExtraIncome: number,
  changePercent: number,
  now = today(),
) {
  const accounts = data.accounts.filter(
    (a) => a.currency === currency && a.kind !== "credit",
  );
  const ids = new Set(accounts.map((a) => a.id));
  let value = accounts.reduce((s, a) => s + balance(data, a, now), 0);
  const points = [{ date: now, balance: value, income: 0, spending: 0 }];
  const end = addMonths(now, months);
  const due = occurrences(data, now, end);
  for (let n = 1; n <= months; n++) {
    const date = addMonths(now, n),
      previous = addMonths(now, n - 1);
    const items = due.filter(
      (d) =>
        (d.date > previous || (n === 1 && d.date === now)) &&
        d.date <= date &&
        ids.has(d.item.accountId),
    );
    const future = data.transactions.filter(
      (t) =>
        ids.has(t.accountId) &&
        t.status === "posted" &&
        t.date > previous &&
        t.date <= date,
    );
    const income =
      monthlyExtraIncome +
      items
        .filter((d) => d.item.kind === "income")
        .reduce((s, d) => s + d.item.amount, 0);
    const spending =
      Math.round(monthlySpending * (1 + changePercent / 100)) +
      items
        .filter((d) => d.item.kind === "expense")
        .reduce((s, d) => s + d.item.amount, 0);
    value += income - spending + future.reduce((s, t) => s + t.amount, 0);
    points.push({ date, balance: value, income, spending });
  }
  return points;
}
export function validateFinance(value: unknown): FinanceData {
  if (!value || typeof value !== "object")
    throw new Error("This is not a Cresco Finance backup.");
  const d = value as FinanceData;
  if (d.schema !== 1)
    throw new Error(
      "This Finance file uses an unsupported version. Update Cresco before opening it.",
    );
  if (!Number.isSafeInteger(d.revision) || d.revision < 0)
    throw new Error("The Finance file has an invalid revision.");
  const keys = [
    "accounts",
    "transactions",
    "budgets",
    "recurring",
    "assets",
    "goals",
    "rules",
    "imports",
    "snapshots",
  ] as const;
  const text = (v: unknown, max = 300): v is string =>
    typeof v === "string" &&
    v.length <= max &&
    !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(v);
  const amount = (v: unknown): v is number =>
    Number.isSafeInteger(v) && Math.abs(v as number) <= 1e14;
  const currency = (c: unknown) => currencies.includes(c as Currency);
  const date = (v: unknown) => typeof v === "string" && validDate(v);
  for (const k of keys) {
    if (!Array.isArray(d[k]) || d[k].length > 200000)
      throw new Error(`Invalid ${k} in the Finance file.`);
    const seen = new Set<string>();
    for (const item of d[k]) {
      if (!item || !text(item.id, 100) || !item.id || seen.has(item.id))
        throw new Error(`Invalid or duplicate ${k} ID.`);
      seen.add(item.id);
    }
  }
  const accountIds = new Set(d.accounts.map((a) => a.id));
  const account = (id: unknown) => typeof id === "string" && accountIds.has(id);
  if (
    d.accounts.some(
      (a) =>
        !text(a.name) ||
        !a.name.trim() ||
        !text(a.bank) ||
        !currency(a.currency) ||
        !["current", "savings", "credit", "cash"].includes(a.kind) ||
        !amount(a.openingBalance) ||
        !date(a.openingDate) ||
        typeof a.archived !== "boolean" ||
        (a.includeInTotals !== undefined &&
          typeof a.includeInTotals !== "boolean"),
    )
  )
    throw new Error("Invalid account in the Finance file.");
  const scheduleKeys = new Set<string>();
  for (const t of d.transactions) {
    if (
      !account(t.accountId) ||
      !date(t.date) ||
      !text(t.description) ||
      !t.description.trim() ||
      !text(t.category) ||
      (t.categorySource !== undefined &&
        !["suggested", "manual", "known", "rule"].includes(t.categorySource)) ||
      (t.suggestedReview !== undefined &&
        !["unsure", "unanswered"].includes(t.suggestedReview)) ||
      !text(t.note, 2000) ||
      !amount(t.amount) ||
      !["expense", "income", "transfer", "adjustment"].includes(t.kind) ||
      !["posted", "pending"].includes(t.status) ||
      !["manual", "csv", "bank"].includes(t.source)
    )
      throw new Error("Invalid transaction in the Finance file.");
    for (const key of [
      "importKey",
      "batchId",
      "transferId",
      "scheduleKey",
      "providerId",
    ] as const)
      if (t[key] !== undefined && !text(t[key], 1000))
        throw new Error("Invalid transaction reference.");
    if (t.scheduleKey) {
      if (scheduleKeys.has(t.scheduleKey))
        throw new Error("Duplicate recurring payment in the Finance file.");
      scheduleKeys.add(t.scheduleKey);
    }
  }
  const transfers = new Map<string, Transaction[]>();
  for (const t of d.transactions)
    if (t.transferId) {
      const group = transfers.get(t.transferId) ?? [];
      group.push(t);
      transfers.set(t.transferId, group);
    }
  for (const group of transfers.values()) {
    if (
      group.length !== 2 ||
      group.some((t) => t.kind !== "transfer") ||
      group[0].accountId === group[1].accountId ||
      group[0].date !== group[1].date ||
      group[0].status !== group[1].status ||
      group[0].amount * group[1].amount >= 0
    )
      throw new Error("A linked transfer must contain both sides.");
    const a = d.accounts.find((a) => a.id === group[0].accountId)!,
      b = d.accounts.find((a) => a.id === group[1].accountId)!;
    if (a.currency === b.currency && group[0].amount + group[1].amount !== 0)
      throw new Error("A linked transfer must balance.");
  }
  const budgetKeys = new Set<string>();
  for (const b of d.budgets) {
    const key = `${b.month}:${b.currency}:${b.category}`;
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(b.month) ||
      !text(b.category) ||
      !currency(b.currency) ||
      !amount(b.limit) ||
      b.limit <= 0 ||
      budgetKeys.has(key)
    )
      throw new Error("Invalid or duplicate budget.");
    budgetKeys.add(key);
  }
  if (
    d.recurring.some(
      (r) =>
        !text(r.name) ||
        !r.name.trim() ||
        !account(r.accountId) ||
        !amount(r.amount) ||
        r.amount <= 0 ||
        !text(r.category) ||
        !["expense", "income"].includes(r.kind) ||
        !["weekly", "monthly", "yearly"].includes(r.frequency) ||
        !date(r.start) ||
        (r.end !== "" && (!date(r.end) || r.end < r.start)) ||
        typeof r.paused !== "boolean",
    )
  )
    throw new Error("Invalid bill or income schedule.");
  if (
    d.assets.some(
      (a) =>
        !text(a.name) ||
        !a.name.trim() ||
        !currency(a.currency) ||
        !amount(a.value) ||
        a.value < 0 ||
        !date(a.date) ||
        !text(a.note, 2000) ||
        !["asset", "liability"].includes(a.kind),
    )
  )
    throw new Error("Invalid asset or liability.");
  if (
    d.goals.some(
      (g) =>
        !text(g.name) ||
        !g.name.trim() ||
        !currency(g.currency) ||
        !amount(g.target) ||
        g.target <= 0 ||
        !amount(g.saved) ||
        g.saved < 0 ||
        (g.deadline !== "" && !date(g.deadline)) ||
        (g.accountId !== "" &&
          (!account(g.accountId) ||
            d.accounts.find((a) => a.id === g.accountId)?.currency !==
              g.currency)),
    )
  )
    throw new Error("Invalid savings goal.");
  if (
    d.rules.some(
      (r) =>
        !text(r.contains) ||
        !r.contains.trim() ||
        !text(r.category) ||
        !["expense", "income"].includes(r.kind) ||
        (r.match !== undefined && r.match !== "exact"),
    )
  )
    throw new Error("Invalid categorisation rule.");
  if (
    d.imports.some(
      (i) =>
        !account(i.accountId) ||
        !text(i.name) ||
        !text(i.importedAt) ||
        !Number.isSafeInteger(i.count) ||
        i.count < 0 ||
        !Number.isSafeInteger(i.duplicateCount) ||
        i.duplicateCount < 0 ||
        (i.corrections !== undefined &&
          (!Array.isArray(i.corrections) ||
            i.corrections.length > 200000 ||
            i.corrections.some(
              (c) =>
                !text(c.transactionId, 100) ||
                !amount(c.beforeAmount) ||
                !amount(c.afterAmount) ||
                (c.beforeKind !== undefined &&
                  !["expense", "income", "transfer", "adjustment"].includes(
                    c.beforeKind,
                  )) ||
                (c.afterKind !== undefined &&
                  !["expense", "income", "transfer", "adjustment"].includes(
                    c.afterKind,
                  )),
            ))) ||
        (i.status != null && !["applied", "undone"].includes(i.status)),
    )
  )
    throw new Error("Invalid import history.");
  if (
    d.snapshots.some(
      (s) => !date(s.date) || !currency(s.currency) || !amount(s.value),
    )
  )
    throw new Error("Invalid net worth history.");
  return d;
}
