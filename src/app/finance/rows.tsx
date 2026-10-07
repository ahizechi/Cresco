import { apply } from "../core/commands";
import { cx, money } from "../core/format";
import { openDialog, openMenu } from "../core/state";
import type { MenuItem, TxnRow } from "../core/view";
import { Chip } from "../ui/controls";
import { removeTransactions } from "./actions";
import { markCleared, setCategory, unmarkTransfer } from "./commands";
import { MOVE_CATS } from "./selectors";

export function CatChip({ c }: { c: string }) {
  return <Chip k="outline">{c}</Chip>;
}

export function Amount({ t }: { t: TxnRow }) {
  return (
    <span className={cx("num", t.amt > 0 && !t.transfer && "pos")}>
      {money(t.amt, { sign: true })}
    </span>
  );
}

/** Category choices for one transaction. */
export const categoryItems = (t: TxnRow): MenuItem[] =>
  MOVE_CATS.map((c) => ({
    l: c,
    checked: t.cat === c,
    f: () =>
      void apply(
        setCategory([t.id], c),
        `${t.merchant} moved to ${c}. Future imports use this rule.`,
        { undo: true },
      ),
  }));

export function txMenu(t: TxnRow): MenuItem[] {
  const items: MenuItem[] = [
    { l: "Edit", i: "pencil", f: () => openDialog("txn", { t }) },
    {
      l: "Change category",
      i: "list",
      sub: true,
      f: (e) => openMenu(e, categoryItems(t)),
    },
    t.transfer
      ? {
          l: "Not a transfer",
          i: "arrow-left-right",
          f: () =>
            void apply(unmarkTransfer(t.id), "No longer marked as a transfer"),
        }
      : {
          l: "Mark as transfer…",
          i: "arrow-left-right",
          f: () => openDialog("transfer", { ids: [t.id] }),
        },
  ];
  if (t.status === "pending")
    items.push({
      l: "Mark as cleared",
      i: "circle-check",
      f: () => void apply(markCleared(t.id), "Marked as cleared"),
    });
  items.push(
    { sep: true },
    {
      l: "Delete",
      i: "trash-2",
      danger: true,
      f: () => removeTransactions([t.id]),
    },
  );
  return items;
}
