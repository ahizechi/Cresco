import type { FinanceData, ImportBatch, Transaction } from "./model";

type Correction = NonNullable<ImportBatch["corrections"]>[number];

/** Apply a reviewed CSV import without replacing annotations on saved rows. */
export function applyCsvImport(
  data: FinanceData,
  batch: ImportBatch,
  additions: Transaction[],
  corrections: Correction[],
): FinanceData {
  if (additions.length !== batch.count)
    throw new Error("The import review changed. Review the file again.");
  const ids = new Set<string>();
  for (const correction of corrections) {
    if (ids.has(correction.transactionId))
      throw new Error("A correction appears twice.");
    ids.add(correction.transactionId);
    const saved = data.transactions.find(
      (row) => row.id === correction.transactionId,
    );
    if (
      !saved ||
      saved.accountId !== batch.accountId ||
      saved.source !== "csv" ||
      saved.amount !== correction.beforeAmount ||
      (correction.beforeKind && saved.kind !== correction.beforeKind)
    )
      throw new Error(
        "A saved transaction changed since review. Review the statement again.",
      );
  }
  for (const row of additions) {
    if (
      row.accountId !== batch.accountId ||
      ids.has(row.id) ||
      data.transactions.some(
        (saved) =>
          saved.id === row.id ||
          (row.importKey &&
            saved.accountId === row.accountId &&
            saved.importKey === row.importKey),
      )
    )
      throw new Error(
        "The ledger changed since review. Review the statement again.",
      );
    ids.add(row.id);
  }
  const changes = new Map(corrections.map((row) => [row.transactionId, row]));
  return {
    ...data,
    transactions: [
      ...additions.map((row) => ({ ...row, batchId: batch.id })),
      ...data.transactions.map((row) => {
        const correction = changes.get(row.id);
        return correction
          ? {
              ...row,
              amount: correction.afterAmount,
              kind: correction.afterKind ?? row.kind,
            }
          : row;
      }),
    ],
    imports: [{ ...batch, corrections }, ...data.imports],
  };
}

/** Undo additions and fee corrections together, refusing to erase later edits. */
export function undoCsvImport(data: FinanceData, id: string): FinanceData {
  const batch = data.imports.find((row) => row.id === id);
  if (!batch || batch.status === "undone")
    throw new Error("This import is no longer active.");
  const corrections = new Map(
    (batch.corrections ?? []).map((row) => [row.transactionId, row]),
  );
  const added = data.transactions.filter((row) => row.batchId === id);
  if (
    added.some(
      (row) =>
        row.transferId &&
        data.transactions.some(
          (peer) => peer.transferId === row.transferId && peer.batchId !== id,
        ),
    )
  )
    throw new Error(
      "An imported row is linked to a transfer outside this import. Unlink it before undoing.",
    );
  for (const correction of corrections.values()) {
    const saved = data.transactions.find(
      (row) => row.id === correction.transactionId,
    );
    if (
      !saved ||
      saved.amount !== correction.afterAmount ||
      (correction.afterKind && saved.kind !== correction.afterKind)
    )
      throw new Error(
        "A corrected transaction changed later. Review it before undoing this import.",
      );
  }
  return {
    ...data,
    transactions: data.transactions
      .filter((row) => row.batchId !== id)
      .map((row) => {
        const correction = corrections.get(row.id);
        return correction
          ? {
              ...row,
              amount: correction.beforeAmount,
              kind: correction.beforeKind ?? row.kind,
            }
          : row;
      }),
    imports: data.imports.map((row) =>
      row.id === id ? { ...row, status: "undone" } : row,
    ),
  };
}
