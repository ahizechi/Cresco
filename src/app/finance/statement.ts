// Reading a CSV statement for review before it is imported.
import {
  previewCsv,
  readCsv,
  type ImportCorrection,
} from "../../features/finance/csv";
import type { Transaction } from "../../features/finance/model";
interface Suggestion {
  label: string;
  p: number;
}
import { dashboard } from "../core/state";

import { CATS } from "./selectors";

/** Categories a statement row can take. */
export const ROW_CATS = Object.keys(CATS).filter((c) => c !== "Transfer");

export interface ReviewRow extends Transaction {
  on: boolean;
  suggestion: Suggestion | null;
}
export interface ReviewCorrection extends ImportCorrection {
  on: boolean;
}

/** The new rows of a statement for one account; rows already saved are counted, not returned. */
export async function readStatement(file: File, accountId: string) {
  const data = dashboard.finance.data;
  const account = data.accounts.find((a) => a.id === accountId);
  if (!account) throw new Error("Choose an account to import into.");
  const csv = readCsv(await file.text());
  const preview = previewCsv(csv.headers, csv.rows, csv.mapping, account, data);
  if (preview.errors.length)
    throw new Error(preview.errors.slice(0, 3).join(" "));
  return {
    rows: preview.transactions.map((t): ReviewRow => ({
      ...t,
      on: true,
      suggestion: null,
    })),
    duplicates: preview.duplicates,
    corrections: preview.corrections.map((row): ReviewCorrection => ({
      ...row,
      on: true,
    })),
    excluded: preview.excluded,
    reverted: preview.reverted,
    feeRows: preview.feeRows,
    sourceRows: csv.rows.length,
  };
}

export async function suggestCategories(
  rows: ReviewRow[],
  _continue: () => boolean = () => true,
  progress: (done: number, total: number) => void = () => {},
) {
  progress(rows.length, rows.length);
  return { rows, error: "" };
}
