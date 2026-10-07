import Papa from "papaparse";
import { knownMerchantCategory, merchantKey } from "./merchants";
import {
  id,
  parseMoney,
  validDate,
  inputMoney,
  type Account,
  type FinanceData,
  type Transaction,
} from "./model";
export type Mapping = {
  date: string;
  description: string;
  amount: string;
  debit: string;
  credit: string;
  currency: string;
  status: string;
  reference: string;
  fee: string;
  transactionType: string;
  dateFormat: "dmy" | "mdy" | "iso";
};
export function readCsv(text: string) {
  if (text.length > 20_000_000)
    throw new Error(
      "This CSV is larger than 20 MB. Export a shorter date range.",
    );
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
    skipEmptyLines: "greedy",
  });
  if (parsed.errors.length)
    throw new Error(`CSV could not be read: ${parsed.errors[0].message}`);
  const headerIndex = parsed.data.findIndex((row) =>
    row.some((cell) =>
      /^(transaction date|date|started date|completed date|booking date)$/i.test(
        cell.trim(),
      ),
    ),
  );
  if (headerIndex < 0)
    throw new Error(
      "No date header found. Use a CSV with a header row including Date or Transaction Date.",
    );
  const headers = parsed.data[headerIndex].map((s) => s.trim());
  if (new Set(headers).size !== headers.length)
    throw new Error(
      "Column names must be unique. Rename repeated or empty headers in the CSV.",
    );
  const find = (pattern: RegExp) => headers.find((h) => pattern.test(h)) ?? "";
  const revolut = [
    "Type",
    "Product",
    "Started Date",
    "Completed Date",
    "Description",
    "Amount",
    "Fee",
    "Currency",
    "State",
    "Balance",
  ].every((name) => headers.includes(name));
  const mapping: Mapping = {
    date:
      find(/^completed date$/i) ||
      find(
        /^(completed date|transaction date|date|started date|booking date)$/i,
      ),
    description: find(
      /^(description|transaction description|merchant|reference|payee)$/i,
    ),
    amount: find(/^(amount|value|transaction amount)$/i),
    debit: find(/^(debit amount|debit|paid out|money out|withdrawals)$/i),
    credit: find(/^(credit amount|credit|paid in|money in|deposits)$/i),
    currency: find(/^currency$/i),
    status: find(/^(state|status)$/i),
    reference: find(/^(transaction id|id|reference number)$/i),
    // Revolut exports Fee separately from Amount. Other banks may already
    // include charges in Amount, so apply this only to its known column set.
    fee: revolut ? "Fee" : "",
    transactionType: revolut ? "Type" : "",
    dateFormat: "dmy",
  };
  return { headers, rows: parsed.data.slice(headerIndex + 1), mapping };
}
function csvDate(raw: string, format: Mapping["dateFormat"]) {
  const s = raw.trim().split(/[ T]/)[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(s) && validDate(s)) return s;
  const match = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (!match || format === "iso")
    throw new Error("Date must match the selected format.");
  const value = `${match[3]}-${(format === "dmy" ? match[2] : match[1]).padStart(2, "0")}-${(format === "dmy" ? match[1] : match[2]).padStart(2, "0")}`;
  if (!validDate(value)) throw new Error("Invalid date.");
  return value;
}
export type ImportPreview = {
  transactions: Transaction[];
  corrections: ImportCorrection[];
  duplicates: number;
  excluded: number;
  reverted: number;
  feeRows: number;
  errors: string[];
};
export type ImportCorrection = {
  transactionId: string;
  beforeAmount: number;
  afterAmount: number;
  beforeKind?: Transaction["kind"];
  afterKind?: Transaction["kind"];
  date: string;
  description: string;
};
export function previewCsv(
  headers: string[],
  rows: string[][],
  mapping: Mapping,
  account: Account,
  data: FinanceData,
): ImportPreview {
  const result: ImportPreview = {
    transactions: [],
    corrections: [],
    duplicates: 0,
    excluded: 0,
    reverted: 0,
    feeRows: 0,
    errors: [],
  };
  const seen = new Map<string, number>();
  const existing = new Map<string, Transaction[]>();
  for (const t of data.transactions.filter((t) => t.accountId === account.id)) {
    const key = t.importKey ?? fingerprint(t);
    existing.set(key, [...(existing.get(key) ?? []), t]);
  }
  const matched = new Set<string>();
  if (
    !mapping.date ||
    !mapping.description ||
    (!mapping.amount && !mapping.debit && !mapping.credit)
  )
    return {
      ...result,
      errors: [
        "Map a date, description and amount (or money in / money out) column.",
      ],
    };
  const get = (row: string[], key: string) =>
    key ? (row[headers.indexOf(key)]?.trim() ?? "") : "";
  rows.forEach((row, index) => {
    try {
      if (row.length !== headers.length)
        throw new Error("Column count differs from the header.");
      const state = get(row, mapping.status).toLowerCase();
      if (
        ["reverted", "declined", "failed", "cancelled", "canceled"].includes(
          state,
        )
      ) {
        result.excluded++;
        if (state === "reverted") result.reverted++;
        return;
      }
      if (
        state &&
        ![
          "completed",
          "complete",
          "posted",
          "booked",
          "pending",
          "pending approval",
        ].includes(state)
      )
        throw new Error(
          `Unrecognised status “${state.slice(0, 40)}”. Map the correct status column or remove the mapping.`,
        );
      const dateValue =
        get(row, mapping.date) ||
        (state.startsWith("pending") && /^completed date$/i.test(mapping.date)
          ? get(row, headers.find((h) => /^started date$/i.test(h)) ?? "")
          : "");
      const date = csvDate(dateValue, mapping.dateFormat);
      const description = get(row, mapping.description);
      if (!description) throw new Error("Description is empty.");
      const currency = get(row, mapping.currency).toUpperCase();
      if (currency && currency !== account.currency)
        throw new Error(
          `Currency ${currency} does not match ${account.currency}. Import each currency into its own account.`,
        );
      const rawAmount = mapping.amount
        ? parseMoney(get(row, mapping.amount), account.currency)
        : Math.abs(
            parseMoney(get(row, mapping.credit) || "0", account.currency),
          ) -
          Math.abs(
            parseMoney(get(row, mapping.debit) || "0", account.currency),
          );
      const fee = mapping.fee
        ? parseMoney(get(row, mapping.fee) || "0", account.currency)
        : 0;
      const amount = rawAmount - fee;
      if (fee) result.feeRows++;
      if (amount === 0) {
        result.excluded++;
        return;
      }
      const normalized = description.trim().toLowerCase();
      const identity = merchantKey(description);
      const transactionType = get(row, mapping.transactionType).toLowerCase();
      const kind =
        transactionType === "card refund"
          ? "expense"
          : transactionType === "deposit return"
            ? "income"
            : amount < 0
              ? "expense"
              : "income";
      const rule = data.rules.find(
        (r) =>
          r.kind === kind &&
          (r.match === "exact"
            ? normalized === r.contains.trim().toLowerCase() ||
              identity === merchantKey(r.contains)
            : normalized.includes(r.contains.trim().toLowerCase()) ||
              (merchantKey(r.contains).length >= 3 &&
                identity.includes(merchantKey(r.contains)))),
      );
      const knownCategory =
        kind === "expense" ? knownMerchantCategory(description) : null;
      const t: Transaction = {
        id: id(),
        accountId: account.id,
        date,
        description,
        amount,
        category:
          rule?.category ??
          knownCategory ??
          (rawAmount === 0 && fee > 0 ? "Fees" : "Uncategorised"),
        categorySource: rule ? "rule" : knownCategory ? "known" : undefined,
        kind,
        status: state.startsWith("pending") ? "pending" : "posted",
        source: "csv",
        note: "",
      };
      const reference = get(row, mapping.reference);
      t.importKey = reference ? `ref:${reference}:${t.status}` : fingerprint(t);
      const legacyKey = reference
        ? t.importKey
        : fingerprint({ ...t, amount: rawAmount });
      const occurrence = (seen.get(t.importKey) ?? 0) + 1;
      if (reference && occurrence > 1)
        throw new Error(
          "This unique transaction ID is repeated in the file. Check the ID mapping or remove the duplicate row.",
        );
      seen.set(t.importKey, occurrence);
      const current = (existing.get(t.importKey) ?? []).find(
        (saved) => !matched.has(saved.id),
      );
      const legacy =
        current ??
        (existing.get(legacyKey) ?? []).find((saved) => !matched.has(saved.id));
      if (legacy) {
        matched.add(legacy.id);
        const oldKind = rawAmount < 0 ? "expense" : "income";
        if (
          legacy.amount === rawAmount &&
          (amount !== rawAmount || legacy.kind !== kind) &&
          legacy.source === "csv" &&
          legacy.kind === oldKind &&
          legacy.status === t.status &&
          legacy.date === t.date &&
          legacy.description === t.description
        ) {
          result.corrections.push({
            transactionId: legacy.id,
            beforeAmount: rawAmount,
            afterAmount: amount,
            beforeKind: legacy.kind,
            afterKind: kind,
            date,
            description,
          });
          return;
        }
        if (legacy.amount !== amount || legacy.kind !== kind)
          throw new Error(
            "A matching saved transaction has changed. Review it manually before re-importing.",
          );
        result.duplicates++;
        return;
      }
      result.transactions.push(t);
    } catch (e) {
      result.errors.push(
        `Row ${index + 2}: ${e instanceof Error ? e.message : "Could not read row."}`,
      );
    }
  });
  return result;
}
export function fingerprint(t: Transaction) {
  return JSON.stringify([
    t.date,
    t.amount,
    t.description.trim().toLowerCase().replace(/\s+/g, " "),
    t.status,
  ]);
}
export function transactionsCsv(
  data: FinanceData,
  transactions = data.transactions,
) {
  return Papa.unparse(
    transactions.map((t) => {
      const a = data.accounts.find((a) => a.id === t.accountId)!;
      return {
        Date: t.date,
        Account: a.name,
        Currency: a.currency,
        Description: t.description,
        Amount: Number(inputMoney(t.amount, a.currency)),
        Category: t.category,
        Kind: t.kind,
        Status: t.status,
        Notes: t.note,
      };
    }),
    { escapeFormulae: true },
  );
}
