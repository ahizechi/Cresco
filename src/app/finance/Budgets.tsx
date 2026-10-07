import { apply } from "../core/commands";
import { MON, TODAY, dshort, toD } from "../core/dates";
import { vars } from "../core/dom";
import { cx, money, moneyAxis } from "../core/format";
import { S, go, openDialog } from "../core/state";
import { Bar, Btn, Tile } from "../ui/controls";
import { Panel, RowMenu } from "../ui/layout";
import { LineChart } from "../ui/charts";
import { deleteGoal, removeBudget } from "./commands";
import {
  CATS,
  acctName,
  budgetPace,
  budgetRows,
  daysLeftInMonth,
  monthName,
  monthsUntil,
} from "./selectors";

export function FinBudgets() {
  const bl = budgetRows();
  const lim = bl.reduce((a, b) => a + b.limit, 0),
    sp = bl.reduce((a, b) => a + b.spent, 0);
  const { days, values } = budgetPace();
  const mon = MON[toD(TODAY).getMonth()];
  const add = (
    <Btn sm i="plus" onClick={() => openDialog("budget")}>
      Add budget
    </Btn>
  );
  return (
    <div className="view">
      <div className="g g-main">
        <Panel
          title={`${monthName()} budgets`}
          detail={`${money(sp, { whole: true })} of ${money(lim, { whole: true })} spent · ${daysLeftInMonth()} days left`}
          list
          isEmpty={bl.length === 0}
          empty={{ icon: "piggy-bank", title: "No budgets yet", action: add }}
          actions={add}
        >
          <div className="rows">
            {bl.map((b) => {
              const over = b.spent > b.limit;
              return (
                <div
                  key={b.cat}
                  className="habit"
                  style={{ gridTemplateColumns: "auto minmax(0,1fr) auto" }}
                >
                  <Tile i={CATS[b.cat]?.i || "circle-dashed"} sm plain />
                  <div className="habit-top">
                    <span>
                      {b.cat}
                      {b.roll && <span className="meta"> · rolls over</span>}
                    </span>
                    <span className={cx("num", over ? "neg" : "muted")}>
                      {`${money(b.spent, { whole: true })} of ${money(b.limit, { whole: true })} · ${
                        over
                          ? money(b.spent - b.limit, { whole: true }) + " over"
                          : money(b.limit - b.spent, { whole: true }) + " left"
                      }`}
                    </span>
                  </div>
                  <Bar value={b.spent} max={b.limit} over={over} />
                  <div className="row-end">
                    <RowMenu
                      label={"Actions for " + b.cat}
                      items={[
                        {
                          l: "Edit limit",
                          i: "pencil",
                          f: () =>
                            openDialog("budget", {
                              b: S.budgets.find((x) => x.cat === b.cat),
                            }),
                        },
                        {
                          l: "See transactions",
                          i: "receipt-text",
                          f: () => go("finance", "transactions"),
                        },
                        { sep: true },
                        {
                          l: "Remove budget",
                          i: "trash-2",
                          danger: true,
                          f: () =>
                            void apply(
                              removeBudget(b.cat),
                              `${b.cat} budget removed`,
                              { undo: true },
                            ),
                        },
                      ]}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel
          title="Spending pace"
          detail="Budgeted categories, cumulative"
          list
        >
          <LineChart
            height={220}
            labels={days.map((d) => String(d))}
            titles={days.map((d) => `${d} ${mon}`)}
            xEvery={7}
            series={[
              { name: "Spent", color: "var(--spend)", values },
              {
                name: "Even pace",
                color: "var(--fg-subtle)",
                dashed: true,
                fillOpacity: 0,
                values: days.map((d) => Math.round((lim * d) / days.length)),
              },
            ]}
            fmt={(v) => money(v, { whole: true })}
            fmtAxis={(v) => moneyAxis(v)}
            label="Cumulative spending against an even pace"
          />
          <div className="legend" style={{ marginTop: "8px" }}>
            <span>
              <i className="swatch" style={vars({ "--c": "var(--spend)" })} />
              Spent
            </span>
            <span>
              <i
                className="swatch"
                style={vars({ "--c": "var(--fg-subtle)" })}
              />
              {`Even pace to ${money(lim, { whole: true })}`}
            </span>
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function FinGoals() {
  const add = (
    <Btn sm i="plus" onClick={() => openDialog("goal")}>
      New goal
    </Btn>
  );
  return (
    <Panel
      title="Goals"
      detail="Money set aside is tracked against a named account."
      list
      isEmpty={S.goals.length === 0}
      empty={{
        icon: "target",
        title: "No goals yet",
        text: "Set a target and a date; Cresco shows what's needed each month.",
        action: add,
      }}
      actions={add}
    >
      <div className="rows">
        {S.goals.map((g) => {
          const left = Math.max(0, g.target - g.saved);
          const months = monthsUntil(g.by);
          return (
            <div key={g.id} className="habit">
              <Tile i={g.icon} tone={g.tone} />
              <div className="habit-top">
                <span>
                  {g.name}
                  <span className="meta">
                    {` · by ${dshort(g.by)} ${toD(g.by).getFullYear()} · ${acctName(g.acct)}`}
                  </span>
                </span>
                <span className="num">
                  <span className="strong">
                    {money(g.saved, { whole: true })}
                  </span>
                  <span className="muted">
                    {` of ${money(g.target, { whole: true })} · ${Math.round((g.saved / g.target) * 100)}%`}
                  </span>
                </span>
              </div>
              <Bar value={g.saved} max={g.target} tone={g.tone} />
              <div className="row-end" style={{ gridRow: "1/span 3" }}>
                <Btn sm onClick={() => openDialog("contrib", { g })}>
                  Add money
                </Btn>
                <RowMenu
                  label={"Actions for " + g.name}
                  items={[
                    {
                      l: "Update progress",
                      i: "pencil",
                      f: () => openDialog("contrib", { g, correct: true }),
                    },
                    {
                      l: "Edit",
                      i: "pencil",
                      f: () => openDialog("goal", { g }),
                    },
                    { sep: true },
                    {
                      l: "Delete",
                      i: "trash-2",
                      danger: true,
                      f: () =>
                        void apply(deleteGoal(g.id), g.name + " deleted", {
                          undo: true,
                        }),
                    },
                  ]}
                />
              </div>
              <div className="meta" style={{ gridColumn: "2" }}>
                {left
                  ? `${money(Math.ceil(left / months), { whole: true })} a month for ${months} months reaches it on time`
                  : "Reached"}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
