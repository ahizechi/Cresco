import { apply } from "../core/commands";
import { S, openDialog } from "../core/state";
import { Btn } from "../ui/controls";
import { exportTransactions, removeTransactions } from "./actions";
import { setCategory } from "./commands";
import { MOVE_CATS } from "./selectors";

/** Actions for the selected transactions. */
export function BulkBar({ sel, clear }: { sel: string[]; clear: () => void }) {
  return (
    <div className="bulkbar" role="toolbar" aria-label="Selected transactions">
      <span className="strong">{`${sel.length} selected`}</span>
      <span style={{ flex: "1" }} />
      <select
        className="select"
        aria-label="Set category"
        value=""
        onChange={(e) => {
          const c = e.target.value;
          if (!c) return;
          void apply(setCategory(sel, c), `Moved ${sel.length} to ${c}`, {
            undo: true,
          }).then((ok) => ok && clear());
        }}
      >
        <option value="">Set category…</option>
        {MOVE_CATS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <Btn
        sm
        i="arrow-left-right"
        onClick={() => openDialog("transfer", { ids: sel, done: clear })}
      >
        Mark as transfer
      </Btn>
      <Btn
        sm
        i="download"
        onClick={() =>
          void exportTransactions(S.txns.filter((row) => sel.includes(row.id)))
        }
      >
        Export
      </Btn>
      <Btn sm i="trash-2" onClick={() => removeTransactions(sel, clear)}>
        Delete
      </Btn>
      <Btn sm icon i="x" aria-label="Clear selection" onClick={clear} />
    </div>
  );
}
