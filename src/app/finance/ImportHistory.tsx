import { useState } from "react";
import { dashboard, confirmDialog } from "../core/state";
import { apply } from "../core/commands";
import { Panel } from "../ui/layout";
import { Btn, Status } from "../ui/controls";
import { undoImport } from "./commands";
export function ImportHistory() {
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const imports = dashboard.finance.data.imports;
  if (!imports.length) return null;
  const current = Math.min(
    page,
    Math.max(0, Math.ceil(imports.length / 5) - 1),
  );
  const rows = imports.slice(current * 5, current * 5 + 5);
  return (
    <Panel
      title="Import history"
      detail="Undo removes the rows added by that import, including edits to those rows, and reverses its reviewed corrections. Saved category rules remain."
    >
      <div className="rows">
        {rows.map((row) => (
          <div className="row" key={row.id}>
            <div className="row-main">
              {row.name}
              <div className="row-sub">
                {row.count} new transactions ? {row.corrections?.length || 0}{" "}
                corrections ? {row.duplicateCount} duplicates skipped
              </div>
            </div>
            <Status s={row.status || "applied"} />
            {row.status !== "undone" && (
              <Btn
                sm
                disabled={busy}
                onClick={() =>
                  confirmDialog({
                    title: "Undo import?",
                    text:
                      "This removes all transactions added by " +
                      row.name +
                      ", including any edits to those rows, and reverses reviewed corrections where they have not changed later. Transfers linked outside the import must be unlinked first. The import receipt remains in history.",
                    ok: "Undo import",
                    danger: true,
                    f: () => {
                      setBusy(true);
                      void apply(undoImport(row.id), "Import undone").finally(
                        () => setBusy(false),
                      );
                    },
                  })
                }
              >
                Undo import
              </Btn>
            )}
          </div>
        ))}
      </div>
      {imports.length > 5 && (
        <div className="pager">
          <Btn sm disabled={current === 0} onClick={() => setPage(current - 1)}>
            Previous imports
          </Btn>
          <span>
            Page {current + 1} of {Math.ceil(imports.length / 5)}
          </span>
          <Btn
            sm
            disabled={(current + 1) * 5 >= imports.length}
            onClick={() => setPage(current + 1)}
          >
            Next imports
          </Btn>
        </div>
      )}
    </Panel>
  );
}
