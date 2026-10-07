import {
  balance,
  occurrences,
  recordOccurrence,
  validDate,
  id,
  transfer,
  type FinanceData,
  type Transaction,
} from "./model";

/** Resolves one chosen schedule occurrence, optionally against an existing payment. */
export function settleOccurrence(
  data: FinanceData,
  scheduleId: string,
  dueDate: string,
  paidOn: string,
  transactionId?: string,
): FinanceData {
  if (!validDate(dueDate) || !validDate(paidOn))
    throw new Error("Choose valid due and payment dates.");
  const due = occurrences(data, dueDate, dueDate).find(
    (due) => due.item.id === scheduleId,
  );
  if (!due)
    throw new Error(
      "This occurrence is already recorded, paused or outside the schedule.",
    );
  if (transactionId) {
    const row = data.transactions.find((row) => row.id === transactionId);
    const amount = due.item.amount * (due.item.kind === "income" ? 1 : -1);
    if (
      !row ||
      row.scheduleKey ||
      row.transferId ||
      row.accountId !== due.item.accountId ||
      row.status !== "posted" ||
      row.kind !== due.item.kind ||
      row.amount !== amount
    )
      throw new Error(
        "That saved payment no longer matches this occurrence. Review it again.",
      );
    return {
      ...data,
      transactions: data.transactions.map((row) =>
        row.id === transactionId ? { ...row, scheduleKey: due.key } : row,
      ),
    };
  }
  const recorded = recordOccurrence(data, due);
  return {
    ...recorded,
    transactions: recorded.transactions.map((row) =>
      row.scheduleKey === due.key ? { ...row, date: paidOn } : row,
    ),
  };
}

export function editTransaction(
  data: FinanceData,
  transactionId: string,
  patch: Partial<
    Pick<
      Transaction,
      | "accountId"
      | "date"
      | "description"
      | "amount"
      | "category"
      | "status"
      | "note"
    >
  >,
): FinanceData {
  if (!data.transactions.some((row) => row.id === transactionId))
    throw new Error("This transaction is no longer available.");
  return {
    ...data,
    transactions: data.transactions.map((row) =>
      row.id === transactionId ? { ...row, ...patch } : row,
    ),
  };
}

export function reconcileAccount(
  data: FinanceData,
  accountId: string,
  statementBalance: number,
  date: string,
): FinanceData {
  const account = data.accounts.find((row) => row.id === accountId);
  if (!account) throw new Error("This account is no longer available.");
  if (!validDate(date) || date < account.openingDate)
    throw new Error("The statement date must be on or after the opening date.");
  const difference = statementBalance - balance(data, account, date);
  if (difference === 0) return markAccountReconciled(data, accountId, date);
  return {
    ...data,
    accounts: data.accounts.map((row) =>
      row.id === accountId ? { ...row, reconciledAt: date } : row,
    ),
    transactions: [
      ...data.transactions,
      {
        id: id(),
        accountId,
        date,
        description: "Balance adjustment",
        amount: difference,
        category: "Uncategorised",
        kind: "adjustment",
        status: "posted",
        note: "Added while reconciling",
        source: "manual",
      },
    ],
  };
}

export function markAccountReconciled(
  data: FinanceData,
  accountId: string,
  date: string,
): FinanceData {
  if (!data.accounts.some((row) => row.id === accountId))
    throw new Error("This account is no longer available.");
  return {
    ...data,
    accounts: data.accounts.map((row) =>
      row.id === accountId ? { ...row, reconciledAt: date } : row,
    ),
  };
}

export function linkedTransactionIds(
  data: FinanceData,
  selected: readonly string[],
): Set<string> {
  const ids = new Set(selected);
  for (const row of data.transactions) {
    if (!ids.has(row.id) || !row.transferId) continue;
    for (const peer of data.transactions)
      if (peer.transferId === row.transferId) ids.add(peer.id);
  }
  return ids;
}

export function deleteTransactions(
  data: FinanceData,
  selected: readonly string[],
): FinanceData {
  const ids = linkedTransactionIds(data, selected);
  return {
    ...data,
    transactions: data.transactions.filter((row) => !ids.has(row.id)),
  };
}

export function markTransfer(
  data: FinanceData,
  selected: readonly string[],
  otherAccountId: string,
): FinanceData {
  const rows = selected.map((rowId) =>
    data.transactions.find((row) => row.id === rowId),
  );
  if (
    rows.length < 1 ||
    rows.length > 2 ||
    rows.some((row) => !row || row.transferId)
  )
    throw new Error("Choose one or two unlinked transactions.");
  const first = rows[0]!;
  if (rows.length === 2) {
    const second = rows[1]!;
    const firstAccount = data.accounts.find(
      (account) => account.id === first.accountId,
    );
    const secondAccount = data.accounts.find(
      (account) => account.id === second.accountId,
    );
    if (
      first.accountId === second.accountId ||
      first.date !== second.date ||
      first.status !== second.status ||
      first.amount * second.amount >= 0 ||
      (firstAccount?.currency === secondAccount?.currency &&
        first.amount + second.amount !== 0)
    )
      throw new Error(
        "The two transfer sides need different accounts, matching dates and opposite amounts.",
      );
    const pairId = id();
    return {
      ...data,
      transactions: data.transactions.map((row) =>
        selected.includes(row.id)
          ? {
              ...row,
              transferId: pairId,
              kind: "transfer",
              category: "Transfer",
            }
          : row,
      ),
    };
  }
  if (first.accountId === otherAccountId)
    throw new Error("Choose the other account for this transfer.");
  const fromId = first.amount < 0 ? first.accountId : otherAccountId;
  const toId = first.amount < 0 ? otherAccountId : first.accountId;
  const generated = transfer(
    {
      ...data,
      transactions: data.transactions.filter((row) => row.id !== first.id),
    },
    fromId,
    toId,
    Math.abs(first.amount),
    Math.abs(first.amount),
    first.date,
  );
  const [outgoing, incoming] = generated.transactions.slice(-2);
  const matching = first.amount < 0 ? outgoing : incoming;
  return {
    ...generated,
    transactions: generated.transactions.map((row) =>
      row.id === matching.id
        ? {
            ...first,
            kind: "transfer",
            category: "Transfer",
            transferId: matching.transferId,
          }
        : { ...row, status: first.status },
    ),
  };
}

export function unmarkTransfer(
  data: FinanceData,
  transactionId: string,
): FinanceData {
  const row = data.transactions.find((entry) => entry.id === transactionId);
  if (!row?.transferId) return data;
  return {
    ...data,
    transactions: data.transactions.map((entry) =>
      entry.transferId === row.transferId
        ? {
            ...entry,
            transferId: undefined,
            kind: entry.amount < 0 ? ("expense" as const) : ("income" as const),
            category: entry.amount < 0 ? "Uncategorised" : "Other income",
          }
        : entry,
    ),
  };
}
