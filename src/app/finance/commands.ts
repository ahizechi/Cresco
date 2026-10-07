// Finance changes. Real mode writes the encrypted ledger through the domain
// functions in features/finance; sample mode edits the illustrative rows.
import {
  deleteTransactions as deleteLedgerRows,
  editTransaction,
  markTransfer as markLedgerTransfer,
  reconcileAccount,
  settleOccurrence,
  unmarkTransfer as unmarkLedgerTransfer,
} from "../../features/finance/commands";
import { applyCsvImport, undoCsvImport } from "../../features/finance/import";
import {
  balance,
  currencies,
  type Account,
  type Currency,
  type FinanceData,
  type ImportBatch,
  type Recurring,
  type Transaction,
  validDate,
} from "../../features/finance/model";
import { write, type Change } from "../core/commands";
import { TODAY, iso, toD } from "../core/dates";
import { nid } from "../core/state";
import type {
  AccountRow,
  GoalRow,
  ScheduleRow,
  TxnRow,
  ViewState,
} from "../core/view";
import { sampleDeleteIds } from "./selectors";
import { categoriseMerchant, type MerchantGroup } from "./category-review";
import { merchantKey } from "../../features/finance/merchants";

type Ledger = (data: FinanceData) => FinanceData;
const ledger =
  (change: Ledger): Change["real"] =>
  ({ finance }) =>
    write(finance, change);

const txn = (view: ViewState, id: string) => view.txns.find((t) => t.id === id);

const kindFor = (amount: number, old?: Transaction): Transaction["kind"] =>
  old?.kind === "transfer" || old?.kind === "adjustment"
    ? old.kind
    : amount >= 0
      ? "income"
      : "expense";

/* ---------- transactions ---------- */

type SuggestedRow = {
  id: string;
  kind?: string;
  category: string;
  merchant: string;
  categorySource?: string;
};

/** Suggested decides once per merchant, so a person's Keep or change covers every
 * row that decision categorised: same kind, merchant and Suggested category. */
function withSuggestedSiblings(
  rows: SuggestedRow[],
  ids: string[],
): Set<string> {
  const chosen = new Set(ids);
  const decisions = new Set(
    rows
      .filter((row) => chosen.has(row.id) && row.categorySource === "suggested")
      .map((row) => `${row.kind}:${merchantKey(row.merchant)}:${row.category}`),
  );
  for (const row of rows)
    if (
      row.categorySource === "suggested" &&
      decisions.has(`${row.kind}:${merchantKey(row.merchant)}:${row.category}`)
    )
      chosen.add(row.id);
  return chosen;
}

const ledgerRows = (data: FinanceData): SuggestedRow[] =>
  data.transactions.map((row) => ({ ...row, merchant: row.description }));
const viewRows = (view: ViewState): SuggestedRow[] =>
  view.txns.map((row) => ({ ...row, category: row.cat }));

/** A person's choice becomes an exact merchant rule for later imports. */
function rememberChoice(
  rules: FinanceData["rules"],
  row: Transaction,
  category: string,
  ruleId: string,
) {
  if (category === "Uncategorised") return;
  if (row.kind !== "expense" && row.kind !== "income") return;
  const contains = merchantKey(row.description);
  if (contains.length < 3) return;
  const old = rules.find(
    (rule) =>
      rule.match === "exact" &&
      rule.kind === row.kind &&
      merchantKey(rule.contains) === contains,
  );
  if (old) old.category = category;
  else
    rules.unshift({
      id: ruleId,
      contains,
      category,
      kind: row.kind,
      match: "exact",
    });
}

export function setCategory(ids: string[], cat: string): Change {
  const ruleIds = ids.map(() => nid("rule"));
  return {
    keys: ["txns"],
    sample: (view) => {
      const all = withSuggestedSiblings(viewRows(view), ids);
      for (const t of view.txns)
        if (all.has(t.id)) {
          t.cat = cat;
          t.categorySource = "manual";
          t.suggestedReview = undefined;
        }
    },
    real: ledger((data) => {
      const all = withSuggestedSiblings(ledgerRows(data), ids);
      const updated = [...all].reduce(
        (next, id) => editTransaction(next, id, { category: cat }),
        data,
      );
      const rules = updated.rules.map((rule) => ({ ...rule }));
      updated.transactions
        .filter((row) => ids.includes(row.id))
        .forEach((row, index) =>
          rememberChoice(rules, row, cat, ruleIds[index] ?? nid("rule")),
        );
      return {
        ...updated,
        rules,
        transactions: updated.transactions.map((row) =>
          all.has(row.id)
            ? {
                ...row,
                categorySource: "manual" as const,
                suggestedReview: undefined,
              }
            : row,
        ),
      };
    }),
  };
}

/** Confirms Suggested's pick for the whole merchant and saves it as a rule. */
export function keepSuggestedCategory(id: string): Change {
  const ruleId = nid("rule");
  return {
    keys: ["txns"],
    sample: (view) => {
      const all = withSuggestedSiblings(viewRows(view), [id]);
      for (const row of view.txns)
        if (all.has(row.id)) row.suggestedReview = undefined;
    },
    real: ledger((data) => {
      const row = data.transactions.find((item) => item.id === id);
      if (!row) throw new Error("This transaction changed. Reload Finance.");
      const all = withSuggestedSiblings(ledgerRows(data), [id]);
      const rules = data.rules.map((rule) => ({ ...rule }));
      rememberChoice(rules, row, row.category, ruleId);
      return {
        ...data,
        rules,
        transactions: data.transactions.map((item) =>
          all.has(item.id) ? { ...item, suggestedReview: undefined } : item,
        ),
      };
    }),
  };
}

/** Records that Suggested had no usable answer, so the automatic pass skips these
 * rows until a later import brings new rows for the merchant. */
export function markSuggestedUnanswered(group: MerchantGroup): Change {
  const ids = new Set(group.ids);
  return {
    keys: ["txns"],
    sample: () => {},
    real: ledger((data) => ({
      ...data,
      transactions: data.transactions.map((row) =>
        ids.has(row.id) && row.category === "Uncategorised"
          ? { ...row, suggestedReview: "unanswered" as const }
          : row,
      ),
    })),
  };
}

/** Applies one reviewed merchant choice to all matching uncategorised rows. */
export function setMerchantCategories(
  decisions: {
    group: MerchantGroup;
    category: string;
    model?: { unsure: boolean };
  }[],
  remember: boolean,
): Change {
  const ruleIds = decisions.map(() => nid("rule"));
  return {
    keys: ["txns"],
    sample: () => {},
    real: ledger((data) =>
      decisions.reduce(
        (next, decision, index) =>
          categoriseMerchant(
            next,
            decision.group,
            decision.category,
            remember,
            ruleIds[index],
            decision.model,
          ),
        data,
      ),
    ),
  };
}

export function updateMerchantRule(id: string, category: string): Change {
  return {
    sample: () => {},
    real: ledger((data) => {
      if (!data.rules.some((rule) => rule.id === id))
        throw new Error("This rule changed. Reload Finance.");
      return {
        ...data,
        rules: data.rules.map((rule) =>
          rule.id === id ? { ...rule, category } : rule,
        ),
      };
    }),
  };
}

export function deleteMerchantRule(id: string): Change {
  return {
    sample: () => {},
    real: ledger((data) => {
      if (!data.rules.some((rule) => rule.id === id))
        throw new Error("This rule changed. Reload Finance.");
      return { ...data, rules: data.rules.filter((rule) => rule.id !== id) };
    }),
  };
}

export function markCleared(id: string): Change {
  return {
    sample: (view) => {
      const t = txn(view, id);
      if (t) t.status = "cleared";
    },
    real: ledger((data) => editTransaction(data, id, { status: "posted" })),
  };
}

export function unmarkTransfer(id: string): Change {
  return {
    sample: (view) => {
      const t = txn(view, id);
      if (!t) return;
      t.transfer = null;
      t.cat = t.amt > 0 ? "Income" : "Uncategorised";
    },
    real: ledger((data) => unmarkLedgerTransfer(data, id)),
  };
}

/** Deletes transactions and the other side of any transfer among them. */
export function deleteTransactions(selected: string[]): Change {
  return {
    keys: ["txns"],
    sample: (view) => {
      const ids = sampleDeleteIds(view.txns, selected);
      view.txns = view.txns.filter((row) => !ids.has(row.id));
    },
    real: ledger((data) => deleteLedgerRows(data, selected)),
  };
}

export interface TxnInput {
  date: string;
  merchant: string;
  cat: string;
  acct: string;
  /** Signed minor units. */
  amt: number;
  status: TxnRow["status"];
  note: string;
}

export function saveTransaction(id: string | null, input: TxnInput): Change {
  const status = input.status === "pending" ? "pending" : "posted";
  return {
    keys: ["txns"],
    sample: (view) => {
      const t = id && txn(view, id);
      if (t) Object.assign(t, input);
      else view.txns.unshift({ id: nid("tx"), source: "Manual", ...input });
    },
    real: ledger((data) => {
      if (!id)
        return {
          ...data,
          transactions: [
            ...data.transactions,
            {
              id: nid("tx"),
              accountId: input.acct,
              date: input.date,
              description: input.merchant,
              amount: input.amt,
              category: input.cat,
              kind: kindFor(input.amt),
              status,
              note: input.note,
              source: "manual",
            },
          ],
        };
      const edited = editTransaction(data, id, {
        accountId: input.acct,
        date: input.date,
        description: input.merchant,
        amount: input.amt,
        category: input.cat,
        status,
        note: input.note,
      });
      return {
        ...edited,
        transactions: edited.transactions.map((row) =>
          row.id === id ? { ...row, kind: kindFor(row.amount, row) } : row,
        ),
      };
    }),
  };
}

/** Marks one or two transactions as a transfer with another account. */
export function markTransfer(ids: string[], otherAccount: string): Change {
  return {
    keys: ["txns"],
    sample: (view) => {
      for (const t of view.txns)
        if (ids.includes(t.id)) {
          t.transfer = otherAccount;
          t.cat = "Transfer";
        }
    },
    real: ledger((data) => markLedgerTransfer(data, ids, otherAccount)),
  };
}

/* ---------- accounts ---------- */

const accountKind = (type: string): Account["kind"] => {
  const kind = type.toLowerCase();
  return kind === "credit card"
    ? "credit"
    : kind === "savings" || kind === "cash"
      ? kind
      : "current";
};
const currency = (value: string): Currency =>
  (currencies as readonly string[]).includes(value)
    ? (value as Currency)
    : "GBP";

export interface AccountInput {
  name: string;
  type: string;
  cur: string;
  inNet: boolean;
  /** The new balance; null keeps it. Linked accounts ignore it. */
  bal: number | null;
  baseline?: { date: string; balance: number };
}

export function saveAccount(a: AccountRow | null, input: AccountInput): Change {
  const linked = !!a && a.source !== "Manual";
  return {
    keys: ["accounts"],
    sample: (view) => {
      const row = a && view.accounts.find((x) => x.id === a.id);
      const own = { name: input.name, type: input.type, inNet: input.inNet };
      if (row)
        Object.assign(
          row,
          own,
          linked
            ? {}
            : {
                cur: input.cur,
                bal: input.bal ?? row.bal,
                synced: "Updated today",
              },
        );
      else
        view.accounts.push({
          id: nid("ac"),
          inst: "Manual",
          cur: input.cur,
          bal: input.bal ?? 0,
          source: "Manual",
          synced: "Updated today",
          reconciled: null,
          archived: false,
          ...own,
        });
    },
    real: ledger((data) => {
      const old = a && data.accounts.find((x) => x.id === a.id);
      if (a && !old) throw new Error("This account is no longer available.");
      if (
        input.baseline &&
        (!validDate(input.baseline.date) ||
          input.baseline.date > TODAY ||
          !Number.isSafeInteger(input.baseline.balance))
      )
        throw new Error(
          "Enter a valid opening balance dated on or before today.",
        );
      if (!old)
        return {
          ...data,
          accounts: [
            ...data.accounts,
            {
              id: nid("ac"),
              name: input.name,
              bank: "Manual",
              kind: accountKind(input.type),
              currency: currency(input.cur),
              openingBalance: input.baseline?.balance ?? input.bal ?? 0,
              openingDate: input.baseline?.date ?? TODAY,
              archived: false,
              includeInTotals: input.inNet,
            },
          ],
        };
      const next: Account = {
        ...old,
        name: input.name,
        kind: accountKind(input.type),
        includeInTotals: input.inNet,
      };
      if (!linked) {
        next.currency = currency(input.cur);
        // Move the opening balance so today's balance matches the entry.
        if (input.baseline) {
          next.openingDate = input.baseline.date;
          next.openingBalance = input.baseline.balance;
          next.reconciledAt = undefined;
        } else if (input.bal != null)
          next.openingBalance =
            old.openingBalance + input.bal - balance(data, old);
      }
      return {
        ...data,
        accounts: data.accounts.map((x) => (x === old ? next : x)),
      };
    }),
  };
}

export function setArchived(id: string, archived: boolean): Change {
  return {
    keys: ["accounts"],
    sample: (view) => {
      const a = view.accounts.find((x) => x.id === id);
      if (a) a.archived = archived;
    },
    real: ledger((data) => ({
      ...data,
      accounts: data.accounts.map((x) =>
        x.id === id ? { ...x, archived } : x,
      ),
    })),
  };
}

/** Adds a balance adjustment so the account matches a statement. */
export function reconcile(
  a: AccountRow,
  statement: number,
  date: string,
  expectedDifference?: number,
): Change {
  return {
    keys: ["txns", "accounts"],
    sample: (view) => {
      const difference = expectedDifference ?? statement - a.bal;
      if (difference !== 0)
        view.txns.unshift({
          id: nid("tx"),
          date,
          merchant: "Balance adjustment",
          cat: "Uncategorised",
          acct: a.id,
          amt: difference,
          kind: "adjustment",
          status: "cleared",
          source: "Manual",
          note: "Added while reconciling",
        });
      const row = view.accounts.find((x) => x.id === a.id);
      if (row) row.reconciled = date;
    },
    real: ledger((data) => {
      const account = data.accounts.find((row) => row.id === a.id);
      if (!account || date < account.openingDate)
        throw new Error(
          "Set an opening balance on or before the statement date first.",
        );
      if (
        expectedDifference !== undefined &&
        statement - balance(data, account, date) !== expectedDifference
      )
        throw new Error(
          "The balance changed. Review the dated balance before reconciling again.",
        );
      return reconcileAccount(data, a.id, statement, date);
    }),
  };
}

/* ---------- budgets ---------- */

/** Sets this month's limit for a category. Roll-over is sample-only. */
export function saveBudget(cat: string, limit: number, roll: boolean): Change {
  const month = TODAY.slice(0, 7);
  return {
    keys: ["budgets"],
    sample: (view) => {
      const b = view.budgets.find((x) => x.cat === cat);
      if (b) Object.assign(b, { limit, roll });
      else view.budgets.push({ cat, limit, roll });
    },
    real: ledger((data) => {
      const old = data.budgets.find(
        (b) => b.month === month && b.category === cat,
      );
      return {
        ...data,
        budgets: old
          ? data.budgets.map((b) => (b === old ? { ...b, limit } : b))
          : [
              ...data.budgets,
              {
                id: nid("budget"),
                month,
                category: cat,
                currency: "GBP",
                limit,
              },
            ],
      };
    }),
  };
}

export function removeBudget(cat: string): Change {
  const month = TODAY.slice(0, 7);
  return {
    keys: ["budgets"],
    sample: (view) => {
      view.budgets = view.budgets.filter((b) => b.cat !== cat);
    },
    real: ledger((data) => ({
      ...data,
      budgets: data.budgets.filter(
        (b) => !(b.month === month && b.category === cat),
      ),
    })),
  };
}

/* ---------- bills and income ---------- */

export interface ScheduleInput {
  name: string;
  kind: ScheduleRow["kind"];
  amt: number;
  freq: "Weekly" | "Monthly" | "Yearly";
  /** The first payment. */
  next: string;
  acct: string;
  cat: string;
}

export function saveSchedule(id: string | null, input: ScheduleInput): Change {
  const fields = {
    name: input.name,
    accountId: input.acct,
    amount: input.amt,
    category: input.cat,
    kind: input.kind === "income" ? "income" : "expense",
    start: input.next,
    frequency: input.freq.toLowerCase() as Recurring["frequency"],
  } as const;
  return {
    keys: ["schedules"],
    sample: (view) => {
      const s = id && view.schedules.find((x) => x.id === id);
      if (s) Object.assign(s, input);
      else view.schedules.push({ id: nid("s"), ...input });
    },
    real: ledger((data) => {
      if (id && !data.recurring.some((row) => row.id === id))
        throw new Error("This schedule is no longer available.");
      return {
        ...data,
        recurring: id
          ? data.recurring.map((row) =>
              row.id === id ? { ...row, ...fields } : row,
            )
          : [
              ...data.recurring,
              { id: nid("s"), ...fields, end: "", paused: false },
            ],
      };
    }),
  };
}

export function deleteSchedule(id: string): Change {
  return {
    keys: ["schedules"],
    sample: (view) => {
      view.schedules = view.schedules.filter((x) => x.id !== id);
    },
    real: ledger((data) => ({
      ...data,
      recurring: data.recurring.filter((row) => row.id !== id),
    })),
  };
}

/** The sample schedule's next date after the current one. */
export function advance(s: ScheduleRow) {
  const d = toD(s.next);
  if (s.freq === "Yearly") d.setFullYear(d.getFullYear() + 1);
  else if (s.freq === "Weekly") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return iso(d);
}

/** Records the next payment of a schedule as a transaction. */
export function recordPayment(
  s: ScheduleRow,
  dueDate = s.next,
  paidOn = TODAY,
  transactionId?: string,
): Change {
  return {
    keys: ["txns", "schedules"],
    sample: (view) => {
      view.txns.unshift({
        id: nid("tx"),
        date: paidOn,
        merchant: s.name,
        cat: s.cat,
        acct: s.acct,
        amt: s.kind === "income" ? s.amt : -s.amt,
        status: "cleared",
        source: "Manual",
        note: "Recorded from Bills & income",
      });
      const row = view.schedules.find((x) => x.id === s.id);
      if (row) row.next = advance(s);
    },
    real: ledger((data) => {
      if (paidOn > TODAY)
        throw new Error("A payment cannot be recorded before it happens.");
      return settleOccurrence(data, s.id, dueDate, paidOn, transactionId);
    }),
  };
}

/* ---------- goals ---------- */

export interface GoalInput {
  name: string;
  target: number;
  by: string;
  acct: string;
  /** Sample only; saved goals have no colour. */
  tone: string;
}

export function saveGoal(id: string | null, input: GoalInput): Change {
  return {
    keys: ["goals"],
    sample: (view) => {
      const g = id && view.goals.find((x) => x.id === id);
      if (g) Object.assign(g, input);
      else
        view.goals.push({ id: nid("g"), icon: "target", saved: 0, ...input });
    },
    real: ledger((data) => {
      const fields = {
        name: input.name,
        target: input.target,
        accountId: input.acct,
        deadline: input.by,
      };
      if (id && !data.goals.some((g) => g.id === id))
        throw new Error("This goal is no longer available.");
      return {
        ...data,
        goals: id
          ? data.goals.map((g) => (g.id === id ? { ...g, ...fields } : g))
          : [
              ...data.goals,
              { id: nid("g"), currency: "GBP", saved: 0, ...fields },
            ],
      };
    }),
  };
}

/** Records money set aside for a goal; it doesn't move money. */
export function addToGoal(g: GoalRow, amount: number): Change {
  return {
    keys: ["goals"],
    sample: (view) => {
      const row = view.goals.find((x) => x.id === g.id);
      if (row) row.saved += amount;
    },
    real: ledger((data) => ({
      ...data,
      goals: data.goals.map((x) =>
        x.id === g.id ? { ...x, saved: x.saved + amount } : x,
      ),
    })),
  };
}

export function setGoalProgress(id: string, amount: number): Change {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new Error("Goal progress must be a non-negative amount.");
  return {
    keys: ["goals"],
    sample: (view) => {
      const row = view.goals.find((goal) => goal.id === id);
      if (!row) throw new Error("This goal is no longer available.");
      row.saved = amount;
    },
    real: ledger((data) => {
      if (!data.goals.some((goal) => goal.id === id))
        throw new Error("This goal is no longer available.");
      return {
        ...data,
        goals: data.goals.map((goal) =>
          goal.id === id ? { ...goal, saved: amount } : goal,
        ),
      };
    }),
  };
}

export function deleteGoal(id: string): Change {
  return {
    keys: ["goals"],
    sample: (view) => {
      view.goals = view.goals.filter((x) => x.id !== id);
    },
    real: ledger((data) => ({
      ...data,
      goals: data.goals.filter((x) => x.id !== id),
    })),
  };
}

/* ---------- imports ---------- */

/** Removes the transactions an import added and marks it undone. */
export function undoImport(id: string): Change {
  return {
    keys: ["txns", "imports"],
    sample: (view) => {
      view.txns = view.txns.filter((t) => t.importId !== id);
      const row = view.imports.find((x) => x.id === id);
      if (row) row.status = "undone";
    },
    real: ledger((data) => undoCsvImport(data, id)),
  };
}

export interface SampleImportRow {
  date: string;
  merchant: string;
  cat: string;
  amt: number;
}

/** Adds reviewed statement rows as one import that can be undone. */
export function importRows(
  batch: Omit<ImportBatch, "id" | "importedAt" | "status">,
  rows: Transaction[],
  sampleRows: SampleImportRow[] = [],
  corrections: NonNullable<ImportBatch["corrections"]> = [],
): Change {
  const id = nid("import");
  const ruleIds = rows.map(() => nid("rule"));
  return {
    keys: ["txns", "imports"],
    sample: (view) => {
      for (const r of sampleRows)
        view.txns.unshift({
          id: nid("tx"),
          ...r,
          acct: batch.accountId,
          status: "cleared",
          source: "CSV import",
          note: "",
          importId: id,
        });
      view.imports.unshift({
        id,
        when: "Just now",
        source: "CSV · " + batch.name,
        count: batch.count,
        status: "applied",
      });
    },
    real: ledger((data) => {
      const imported = applyCsvImport(
        data,
        {
          ...batch,
          id,
          importedAt: new Date().toISOString(),
          status: "applied",
        },
        rows,
        corrections,
      );
      // Only a person's choice becomes a rule; Suggested's picks stay Suggested-sourced.
      const rules = imported.rules.map((rule) => ({ ...rule }));
      rows.forEach((row, index) => {
        if (row.categorySource === "manual")
          rememberChoice(rules, row, row.category, ruleIds[index]);
      });
      return { ...imported, rules };
    }),
  };
}
