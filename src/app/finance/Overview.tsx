import { useState } from "react";
import { TODAY, addDays } from "../core/dates";
import { money } from "../core/format";
import { S, go } from "../core/state";
import { Btn } from "../ui/controls";
import { Panel } from "../ui/layout";
import { recurringFromLedger } from "./recurring";

const dateText = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const gbp = () =>
  new Set(
    S.accounts
      .filter((account) => account.cur === "GBP")
      .map((account) => account.id),
  );
const ledger = () => {
  const accounts = gbp();
  return S.txns.filter(
    (row) =>
      accounts.has(row.acct) &&
      row.status === "cleared" &&
      !row.transfer &&
      row.cat !== "Transfer" &&
      (row.kind === "expense" ||
        row.kind === "income" ||
        (!row.kind && row.amt !== 0)),
  );
};

export function dailyCashFlow() {
  const days = new Map<
    string,
    { net: number; in: number; out: number; count: number }
  >();
  for (const row of ledger()) {
    const day = days.get(row.date) ?? { net: 0, in: 0, out: 0, count: 0 };
    day.net += row.amt;
    if (row.amt > 0) day.in += row.amt;
    else day.out += Math.abs(row.amt);
    day.count++;
    days.set(row.date, day);
  }
  return days;
}

function CashCalendar() {
  const [month, setMonth] = useState(TODAY.slice(0, 7));
  const [chosen, setChosen] = useState<string | null>(null);
  const [firstYear, firstMonth] = month.split("-").map(Number);
  const first = new Date(firstYear, firstMonth - 1, 1, 12);
  const daysInMonth = new Date(firstYear, firstMonth, 0).getDate();
  const before = (first.getDay() + 6) % 7;
  const slots = Math.ceil((before + daysInMonth) / 7) * 7;
  const data = dailyCashFlow();
  const shift = (delta: number) => {
    const next = new Date(firstYear, firstMonth - 1 + delta, 1);
    setMonth(
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`,
    );
    setChosen(null);
  };
  const dates = Array.from({ length: slots }, (_, index) => {
    const date = new Date(firstYear, firstMonth - 1, index - before + 1, 12);
    return date.getMonth() === firstMonth - 1 ? dateText(date) : null;
  });
  const selected = chosen ? data.get(chosen) : null;
  return (
    <Panel
      title="Cash flow"
      detail="Money in minus money out per day. Transfers between your own accounts are left out."
      actions={
        <div className="row">
          <Btn sm onClick={() => shift(-1)} aria-label="Previous month">
            ‹
          </Btn>
          <strong>
            {first.toLocaleString("en-GB", { month: "long", year: "numeric" })}
          </strong>
          <Btn sm onClick={() => shift(1)} aria-label="Next month">
            ›
          </Btn>
        </div>
      }
    >
      <div className="cash-scroll">
        <div
          className="cash-grid"
          role="group"
          aria-label={`${first.toLocaleString("en-GB", { month: "long", year: "numeric" })} daily cash flow`}
        >
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <span className="cash-weekday" key={day}>
              {day}
            </span>
          ))}
          {dates.map((date, index) => {
            const value = date ? data.get(date) : null;
            const future = !!date && date > TODAY;
            return date ? (
              <button
                key={date}
                className={`cash-day ${future ? "future" : value ? (value.net >= 0 ? "gain" : "loss") : ""}`}
                aria-label={`${date}: ${future ? "future" : value ? money(value.net) + " net cash flow" : "no transactions"}`}
                aria-pressed={chosen === date}
                onClick={() => setChosen(date)}
              >
                <span>
                  {Number(date.slice(-2))}
                  {date === TODAY ? " · Today" : ""}
                </span>
                <strong>{future ? "" : value ? money(value.net) : "—"}</strong>
                <small>
                  {future
                    ? ""
                    : value
                      ? `${value.count} txn${value.count === 1 ? "" : "s"}`
                      : "No movement"}
                </small>
              </button>
            ) : (
              <span className="cash-day blank" key={`blank-${index}`} />
            );
          })}
        </div>
      </div>
      <div className="cash-foot">
        {chosen ? (
          <span>
            {chosen}:{" "}
            {selected
              ? `${money(selected.in)} in · ${money(selected.out)} out`
              : "No posted GBP transactions"}
          </span>
        ) : (
          <span>Select a day to see what moved</span>
        )}
      </div>
    </Panel>
  );
}

export function FinOverview() {
  const rows = ledger();
  const days = dailyCashFlow();
  const month = TODAY.slice(0, 7);
  const monthRows = rows.filter((row) => row.date.startsWith(month));
  const last30Rows = rows.filter(
    (row) => row.date >= addDays(TODAY, -29) && row.date <= TODAY,
  );
  const monthIn = monthRows.reduce((sum, row) => sum + Math.max(0, row.amt), 0);
  const monthOut = monthRows.reduce(
    (sum, row) => sum + Math.max(0, -row.amt),
    0,
  );
  const recurring = recurringFromLedger();
  const category = new Map<string, number>();
  for (const row of last30Rows.filter((item) => item.amt < 0))
    category.set(row.cat, (category.get(row.cat) ?? 0) + Math.abs(row.amt));
  const categories = [...category.entries()].sort((a, b) => b[1] - a[1]);
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(`${month}-01T12:00:00`);
    date.setMonth(date.getMonth() - (5 - index));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
  const monthIndex = new Map(months.map((value, index) => [value, index]));
  const trendMap = new Map<string, number[]>();
  for (const row of rows) {
    const index = monthIndex.get(row.date.slice(0, 7));
    if (row.amt >= 0 || index == null) continue;
    const values = trendMap.get(row.cat) ?? (Array(6).fill(0) as number[]);
    values[index] += Math.abs(row.amt);
    trendMap.set(row.cat, values);
  }
  const trend = [...trendMap]
    .sort(
      (a, b) =>
        b[1].reduce((sum, value) => sum + value, 0) -
        a[1].reduce((sum, value) => sum + value, 0),
    )
    .slice(0, 5)
    .map(([cat, values]) => ({ cat, values }));
  const trendMax = Math.max(1, ...trend.flatMap((entry) => entry.values));
  const budgets = S.budgets.slice(0, 6);
  const due = S.schedules
    .filter(
      (item) =>
        item.kind === "bill" && item.next && item.next <= addDays(TODAY, 14),
    )
    .sort((a, b) => a.next.localeCompare(b.next));
  const uncategorised = rows.filter(
    (item) => item.cat === "Uncategorised",
  ).length;
  return (
    <div className="view">
      {uncategorised > 0 && (
        <button className="strip" onClick={() => go("finance", "transactions")}>
          {uncategorised} uncategorised transaction
          {uncategorised === 1 ? "" : "s"} · Open Ledger
        </button>
      )}
      <div className="g g-4 fin-metrics">
        <Panel title="Net this month">
          <strong className="earn-figure">{money(monthIn - monthOut)}</strong>
          <span className="meta">Money in less money out</span>
        </Panel>
        <Panel title="Money in">
          <strong className="earn-figure">{money(monthIn)}</strong>
          <span className="meta">Posted GBP income</span>
        </Panel>
        <Panel title="Money out">
          <strong className="earn-figure">{money(monthOut)}</strong>
          <span className="meta">Posted GBP spending</span>
        </Panel>
        <Panel title="Days recorded">
          <strong className="earn-figure">
            {[...days.keys()].filter((day) => day.startsWith(month)).length}
          </strong>
          <span className="meta">This month in the ledger</span>
        </Panel>
      </div>
      <div className="g g-side">
        <CashCalendar />
        <div className="stackc">
          <Panel
            title="Sorted automatically"
            detail="Saved rules and known merchants"
          >
            <p className="meta">
              {uncategorised
                ? `${uncategorised} transactions still need a category.`
                : "Every posted GBP transaction has a category."}
            </p>
            <div className="panel-foot">
              <Btn sm onClick={() => go("finance", "transactions")}>
                Open Ledger
              </Btn>
            </div>
          </Panel>
          <Panel
            title="Recurring"
            detail="Found in your transactions"
            cls="fill"
          >
            {recurring.length ? (
              <div className="rows">
                {recurring.slice(0, 7).map((item) => (
                  <div className="row" key={item.key}>
                    <div className="row-main">
                      <strong>{item.name}</strong>
                      <div className="row-sub">
                        About monthly · next around {item.next}
                      </div>
                    </div>
                    <strong>{money(item.amount)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="meta">
                No matching monthly payments found. Two similar charges 25–35
                days apart are needed.
              </p>
            )}
          </Panel>
        </div>
      </div>
      <div className="g g-3">
        <Panel
          title="Where it went"
          detail="Last 30 days · posted GBP spending"
        >
          {categories.length ? (
            <div className="rows">
              {categories.slice(0, 7).map(([name, value]) => (
                <div className="row" key={name}>
                  <span className="row-main">{name}</span>
                  <strong>{money(value)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="meta">No posted GBP spending in the last 30 days.</p>
          )}
        </Panel>
        <Panel title="Budgets" detail="This month">
          {budgets.length ? (
            <div className="rows">
              {budgets.map((item) => (
                <div className="row" key={item.cat}>
                  <span className="row-main">{item.cat}</span>
                  <strong>{money(item.limit)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="meta">No budgets set.</p>
          )}
        </Panel>
        <Panel title="Coming up" detail="Next 14 days">
          {due.length ? (
            <div className="rows">
              {due.map((item) => (
                <div className="row" key={item.id}>
                  <span className="row-main">
                    {item.next} · {item.name}
                  </span>
                  <strong>{money(item.amt)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="meta">No scheduled bills in the next 14 days.</p>
          )}
        </Panel>
      </div>
      <Panel
        title="Spending trend"
        detail="Categories by month · posted GBP spending only"
      >
        {trend.length ? (
          <div className="fin-trend-scroll">
            <div className="fin-trend">
              <span className="meta" />
              {months.map((value) => (
                <span className="meta" key={value}>
                  {value.slice(5)}
                </span>
              ))}
              {trend.map((entry) => (
                <div className="fin-trend-row" key={entry.cat}>
                  <strong>{entry.cat}</strong>
                  {entry.values.map((value, index) => (
                    <div
                      className="fin-trend-cell"
                      role="img"
                      key={months[index]}
                      title={`${entry.cat} · ${months[index]} · ${money(value)}`}
                      aria-label={`${entry.cat} in ${months[index]}: ${money(value)}`}
                    >
                      <span
                        style={{
                          height: `${Math.max(value ? 4 : 0, (value / trendMax) * 100)}%`,
                        }}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="meta">No monthly spending history yet.</p>
        )}
      </Panel>
    </div>
  );
}
