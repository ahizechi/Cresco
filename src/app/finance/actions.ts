// Finance actions shared by several screens.
import { sampleMode } from "@sample";
import { linkedTransactionIds } from "../../features/finance/commands";
import { transactionsCsv } from "../../features/finance/csv";
import { exportFinanceFile } from "../../features/finance/storage";
import { apply } from "../core/commands";
import { S, confirmDialog, dashboard, toast } from "../core/state";
import type { TxnRow } from "../core/view";
import { deleteTransactions } from "./commands";
import { sampleDeleteIds } from "./selectors";

/** Deletes transactions, confirming first when a transfer's other side goes too. */
export function removeTransactions(selected: string[], done?: () => void) {
  const ids = sampleMode
    ? sampleDeleteIds(S.txns, selected)
    : linkedTransactionIds(dashboard.finance.data, selected);
  const run = async () => {
    const ok = await apply(
      deleteTransactions(selected),
      `Deleted ${ids.size} transaction${ids.size === 1 ? "" : "s"}`,
      { undo: true },
    );
    if (ok) done?.();
  };
  if (ids.size > selected.length)
    confirmDialog({
      title: "Delete linked transfer?",
      text: "Both sides of this transfer will be removed from your ledger. You can undo this action.",
      ok: "Delete both sides",
      danger: true,
      f: () => void run(),
    });
  else void run();
}

export async function exportTransactions(rows: TxnRow[]) {
  if (sampleMode)
    return toast(`Sample view: ${rows.length} transactions selected`);
  try {
    const ids = new Set(rows.map((row) => row.id));
    const data = dashboard.finance.data;
    const csv = transactionsCsv(
      data,
      data.transactions.filter((row) => ids.has(row.id)),
    );
    const saved = await exportFinanceFile(csv, "transactions");
    toast(saved ? `${ids.size} transactions exported` : "Export cancelled");
  } catch (reason) {
    toast(`Could not export transactions: ${String(reason)}`, { error: true });
  }
}
