import { useState } from "react";
import { sampleMode } from "@sample";
import { apply } from "../core/commands";
import { dshort } from "../core/dates";
import { cx, money } from "../core/format";
import { S, openDialog, toast, updateView } from "../core/state";
import type { MenuItem, ScheduleRow } from "../core/view";
import { Btn, Seg, Tile } from "../ui/controls";
import { Panel, RowMenu } from "../ui/layout";
import { advance, deleteSchedule } from "./commands";
import { CATS, acctName, daysUntil } from "./selectors";

export function scheduleMenu(s: ScheduleRow): MenuItem[] {
  const items: MenuItem[] = [
    { l: "Edit", i: "pencil", f: () => openDialog("schedule", { s }) },
  ];
  if (s.next && !s.paused)
    items.push({
      l: s.kind === "income" ? "Mark received" : "Mark paid",
      i: "circle-check",
      f: () => openDialog("schedulePayment", { s }),
    });
  // Saved schedules follow their dates; only the sample can skip one.
  if (sampleMode)
    items.push({
      l: "Skip next",
      i: "chevrons-up-down",
      f: () => {
        const next = advance(s);
        updateView((view) => {
          const row = view.schedules.find((x) => x.id === s.id);
          if (row) row.next = next;
        });
        toast(`Skipped · next ${dshort(next)}`);
      },
    });
  items.push(
    { sep: true },
    {
      l: "Delete",
      i: "trash-2",
      danger: true,
      f: () =>
        void apply(deleteSchedule(s.id), `${s.name} deleted`, { undo: true }),
    },
  );
  return items;
}

/** Scheduled bills and income, soonest first. */
export function BillsTable() {
  const [kind, setKind] = useState<"all" | "bill" | "income">("all");
  const rows = S.schedules
    .filter((s) => kind === "all" || s.kind === kind)
    .sort((a, b) => (a.next || "9999").localeCompare(b.next || "9999"));
  const add = (
    <Btn sm i="plus" onClick={() => openDialog("schedule")}>
      Add bill or income
    </Btn>
  );
  return (
    <Panel
      flush
      list
      isEmpty={rows.length === 0}
      empty={{
        icon: "repeat",
        title: "No bills or income yet",
        text: "Add the regular payments you want to see coming.",
        action: add,
      }}
    >
      <div className="toolbar" style={{ padding: "16px 20px 12px" }}>
        <Seg
          value={kind}
          onChange={setKind}
          options={[
            { v: "all", l: "All" },
            { v: "bill", l: "Bills" },
            { v: "income", l: "Income" },
          ]}
          label="Show"
        />
        <span style={{ flex: "1" }} />
        <Btn i="plus" onClick={() => openDialog("schedule")}>
          Add bill or income
        </Btn>
      </div>
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>Name</th>
              <th>Repeats</th>
              <th>Due</th>
              <th>Account</th>
              <th className="num">Amount</th>
              <th className="w-act">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const days = daysUntil(s.next);
              return (
                <tr key={s.id}>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        alignItems: "center",
                      }}
                    >
                      <Tile
                        i={
                          s.kind === "income"
                            ? "briefcase"
                            : CATS[s.cat]?.i || "zap"
                        }
                        sm
                        plain
                      />
                      {s.name}
                    </div>
                  </td>
                  <td className="muted">{s.freq}</td>
                  <td>
                    {s.paused ? "Paused" : !s.next ? "Ended" : dshort(s.next)}
                    {!s.paused && s.next && (
                      <span className={cx("meta", days <= 7 && "warn")}>
                        {days < 0
                          ? ` · ${-days} day${days === -1 ? "" : "s"} overdue`
                          : days === 0
                            ? " · today"
                            : ` · in ${days} day${days === 1 ? "" : "s"}`}
                      </span>
                    )}
                  </td>
                  <td className="muted">{acctName(s.acct)}</td>
                  <td className="num">
                    <span className={s.kind === "income" ? "pos" : ""}>
                      {money(s.kind === "income" ? s.amt : -s.amt, {
                        sign: true,
                      })}
                    </span>
                  </td>
                  <td className="w-act">
                    <RowMenu
                      label={"Actions for " + s.name}
                      items={scheduleMenu(s)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
