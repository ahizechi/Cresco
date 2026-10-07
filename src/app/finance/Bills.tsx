import { useState } from "react";
import { TODAY, addDays, dshort } from "../core/dates";
import { money, moneyAxis } from "../core/format";
import { Seg } from "../ui/controls";
import { Panel, Source, Stat } from "../ui/layout";
import { LineChart } from "../ui/charts";
import { BillsTable } from "./BillsTable";
import { forecastAccount, next30Days, projection } from "./forecast";

export function FinBills() {
  const [range, setRange] = useState<"30" | "60" | "90">("60");
  const [daily, setDaily] = useState(0);
  const days = Number(range);
  const soon = next30Days();
  const account = forecastAccount();
  const pts = projection(days, daily);
  const lo = Math.min(...pts),
    loI = pts.indexOf(lo);
  const labels = pts.map((_, i) => dshort(addDays(TODAY, i)));
  return (
    <div className="view">
      <div className="g g-3">
        <Stat
          label="Bills in the next 30 days"
          value={money(soon.out, { whole: true })}
          note={`${soon.bills} ${soon.bills === 1 ? "payment" : "payments"}`}
        />
        <Stat
          label="Income expected"
          value={money(soon.in, { whole: true })}
          note={`${soon.incomes} ${soon.incomes === 1 ? "payment" : "payments"}`}
        />
        <Stat
          label="Lowest projected balance"
          value={money(lo, { whole: true })}
          tone={lo < 0 ? "neg" : undefined}
          note={`${account?.name || "No GBP account"} · ${labels[loI]}`}
        />
      </div>
      <Panel
        title="Projected balance"
        detail={`${account?.name || "Your GBP account"}, from scheduled bills and income${daily ? " plus your entered everyday spending" : ""}`}
        list
        actions={
          <Seg
            value={range}
            onChange={setRange}
            options={[
              { v: "30", l: "30 days" },
              { v: "60", l: "60 days" },
              { v: "90", l: "90 days" },
            ]}
            label="Range"
          />
        }
      >
        <LineChart
          height={220}
          labels={labels}
          xEvery={Math.ceil(days / 6)}
          series={[
            { name: "Projected", color: "var(--series-2)", values: pts },
          ]}
          fmt={(v) => money(v)}
          fmtAxis={(v) => moneyAxis(v)}
          label="Projected balance"
          empty="No bills or income scheduled yet."
          markers={[{ i: loI, v: lo, color: "var(--warning)" }]}
          refLine={{ v: 0, label: "£0" }}
        />
        <div className="fc-foot">
          <Source>
            A projection, not a prediction · excludes interest, exchange rates
            and other accounts
          </Source>
          <label className="fc-daily" htmlFor="fc-daily">
            Everyday spending
            <span className="input-icon">
              <span className="fc-pound">£</span>
              <input
                id="fc-daily"
                className="input"
                inputMode="decimal"
                value={(daily / 100).toFixed(2)}
                onChange={(e) => {
                  const v = Math.round(parseFloat(e.target.value) * 100);
                  if (v >= 0) setDaily(v);
                }}
              />
            </span>
            a day
          </label>
        </div>
      </Panel>
      <BillsTable />
    </div>
  );
}
