// Money pictures shared by Trading and Crypto: value over time against what was
// paid, and a share-by-holding donut. Amounts are minor units of `cur`.
import { dmed, dshort } from "../core/dates";
import { vars } from "../core/dom";
import { money, moneyAxis, pct } from "../core/format";
import { LineChart } from "./charts";
import { Donut } from "./spark";

export interface ValuePoint {
  /** Local day, YYYY-MM-DD. */
  day: string;
  value: number | null;
  cost: number | null;
}

export function ValueChart({
  points,
  cur,
  label,
  costName = "What you paid",
}: {
  points: ValuePoint[];
  cur: string;
  label: string;
  costName?: string;
}) {
  const known = points.filter((p) => p.value != null);
  const first = known[0]?.value ?? 0;
  const last = known.at(-1)?.value ?? 0;
  // With a cost line, the result is against what was paid, so money added
  // along the way is not counted as growth; without one, the change in range.
  const paid = known.at(-1)?.cost ?? null;
  const base = paid ?? first;
  const change = last - base;
  const costs = points.map((p) => p.cost);
  const hasCost = costs.some((c) => c != null);
  const all = [...points.map((p) => p.value), ...costs].filter(
    (v): v is number => v != null,
  );
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pad = (hi - lo) * 0.1 || hi * 0.05 || 100;
  return (
    <div className="value-chart">
      <div className="value-head">
        <span className="value-now num">{money(last, { cur })}</span>
        <span className={"num " + (change >= 0 ? "pos" : "neg")}>
          {`${money(change, { cur, sign: true })}${
            base ? ` (${pct((change / base) * 100)})` : ""
          } ${
            paid != null
              ? `against ${costName.toLowerCase()}`
              : `since ${dshort(known[0]?.day ?? points[0].day)}`
          }`}
        </span>
      </div>
      <LineChart
        height={240}
        label={label}
        labels={points.map((p) => dshort(p.day))}
        titles={points.map((p) => dmed(p.day))}
        xEvery={Math.max(1, Math.ceil(points.length / 7))}
        yMin={Math.max(0, lo - pad)}
        yMax={hi + pad}
        fmt={(v) => money(v, { cur })}
        fmtAxis={(v) => moneyAxis(v, cur)}
        series={[
          {
            name: "Value",
            color: change >= 0 ? "var(--success)" : "var(--danger)",
            values: points.map((p) => p.value),
          },
          ...(hasCost
            ? [
                {
                  name: costName,
                  color: "var(--fg-muted)",
                  values: costs,
                  dashed: true,
                  fillOpacity: 0,
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}

export function AllocationDonut({
  parts,
  cur,
}: {
  parts: { label: string; value: number; color: string }[];
  cur: string;
}) {
  const whole = parts.reduce((a, p) => a + p.value, 0);
  return (
    <div className="alloc">
      <Donut parts={parts}>
        <div>
          <div className="meta">Total</div>
          <div className="strong num">
            {money(whole, { cur, whole: whole >= 100_000 })}
          </div>
        </div>
      </Donut>
      <div className="legend" style={{ display: "grid", gap: "6px" }}>
        {parts.map((part) => (
          <span key={part.label}>
            <i className="swatch" style={vars({ "--c": part.color })} />
            {`${part.label} · ${whole ? Math.round((part.value / whole) * 100) : 0}%`}
          </span>
        ))}
      </div>
    </div>
  );
}
