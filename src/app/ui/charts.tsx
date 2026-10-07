// Line and bar charts drawn to one nice-rounded scale, with a hover tooltip and
// a screen-reader table of the same values.
import { useId, useState, type MouseEvent } from "react";
import { clamp } from "../core/format";
import {
  ChartDataTable,
  Tip,
  niceRange,
  showLabel,
  useWidth,
  type ChartProps,
} from "./spark";

export function LineChart({
  labels,
  series,
  height = 220,
  fmt = String,
  fmtAxis = String,
  area = true,
  yMin,
  yMax,
  xEvery = 1,
  markers = [],
  refLine,
  label,
  titles,
  empty,
  gapHatch = false,
}: ChartProps & {
  area?: boolean;
  yMin?: number;
  yMax?: number;
  markers?: { i: number; v: number; color?: string }[];
  refLine?: { v: number; label: string } | null;
  gapHatch?: boolean;
}) {
  const [ref, w] = useWidth();
  const gapId = useId().replaceAll(":", "");
  const [hi, setHi] = useState<number | null>(null);
  const padL = 48,
    padR = 14,
    padT = 10,
    padB = 26;
  const vals = series.flatMap((s) =>
    s.values.filter((v): v is number => v != null),
  );
  const hasData = vals.some((value) => value !== 0);
  const r = niceRange(
    yMin ?? Math.min(0, ...vals),
    yMax ?? Math.max(...vals),
    4,
  );
  const iw = Math.max(10, w - padL - padR),
    ih = height - padT - padB;
  const n = labels.length;
  const x = (i: number) => padL + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v: number) => padT + ih - ((v - r.min) / (r.max - r.min)) * ih;
  const move = (e: MouseEvent<SVGSVGElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - b.left - padL) / iw) * (n - 1));
    setHi(clamp(i, 0, n - 1));
  };
  if (!hasData)
    return (
      <div className="chart chart-empty" ref={ref} role="status">
        {empty || "No readings yet."}
      </div>
    );
  const axisTicks = r.ticks.filter(
    (tick, index) =>
      index === 0 || fmtAxis(tick) !== fmtAxis(r.ticks[index - 1]),
  );
  return (
    <div className="chart" ref={ref} style={{ height: height + "px" }}>
      {w > 0 && (
        <svg
          width={w}
          height={height}
          role="img"
          aria-label={label}
          onMouseMove={move}
          onMouseLeave={() => setHi(null)}
        >
          {gapHatch && (
            <defs>
              <pattern
                id={gapId}
                width="6"
                height="6"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="2" height="6" fill="var(--border)" />
              </pattern>
            </defs>
          )}
          {axisTicks.map((t) => (
            <g key={t}>
              <line
                className="grid"
                x1={padL}
                x2={w - padR}
                y1={Math.round(y(t)) + 0.5}
                y2={Math.round(y(t)) + 0.5}
              />
              <text className="axis" x={padL - 8} y={y(t) + 4} textAnchor="end">
                {fmtAxis(t)}
              </text>
            </g>
          ))}
          {refLine != null && (
            <g>
              <line
                x1={padL}
                x2={w - padR}
                y1={y(refLine.v)}
                y2={y(refLine.v)}
                stroke="var(--fg-subtle)"
                strokeDasharray="4 4"
              />
              <text
                className="axis"
                x={w - padR}
                y={y(refLine.v) - 5}
                textAnchor="end"
              >
                {refLine.label}
              </text>
            </g>
          )}
          {labels.map(
            (l, i) =>
              showLabel(i, n, xEvery) && (
                <text
                  key={i}
                  className="axis"
                  x={x(i)}
                  y={height - 6}
                  textAnchor={
                    i === 0 ? "start" : i === n - 1 ? "end" : "middle"
                  }
                >
                  {l}
                </text>
              ),
          )}
          {gapHatch &&
            labels.map((_, index) =>
              series.every((item) => item.values[index] == null) ? (
                <rect
                  key={`gap-${index}`}
                  x={x(index) - iw / Math.max(1, n - 1) / 2}
                  y={padT}
                  width={iw / Math.max(1, n - 1)}
                  height={ih}
                  fill={`url(#${gapId})`}
                  opacity={0.7}
                />
              ) : null,
            )}
          {series.map((s) => {
            const segments: [number, number][][] = [];
            s.values.forEach((value, index) => {
              if (value == null) return;
              if (index === 0 || s.values[index - 1] == null) segments.push([]);
              segments.at(-1)!.push([value, index]);
            });
            const base = y(Math.max(r.min, 0));
            return (
              <g key={s.name}>
                {segments.map((pts, segment) => {
                  const d = pts
                    .map(
                      ([value, index], point) =>
                        (point ? "L" : "M") +
                        x(index).toFixed(1) +
                        " " +
                        y(value).toFixed(1),
                    )
                    .join("");
                  return (
                    <g key={segment}>
                      {area && pts.length > 1 && (
                        <path
                          d={
                            d +
                            `L${x(pts[pts.length - 1][1])} ${base}L${x(pts[0][1])} ${base}Z`
                          }
                          fill={s.color}
                          fillOpacity={s.fillOpacity ?? 0.1}
                        />
                      )}
                      <path
                        d={d}
                        fill="none"
                        stroke={s.color}
                        strokeWidth="1.75"
                        strokeDasharray={s.dashed ? "5 4" : undefined}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}
          {markers.map((m) => (
            <g key={m.i}>
              <circle
                cx={x(m.i)}
                cy={y(m.v)}
                r="3.5"
                fill="var(--surface)"
                stroke={m.color || "var(--fg)"}
                strokeWidth="1.5"
              />
            </g>
          ))}
          {hi != null && (
            <g>
              <line
                className="guide"
                x1={x(hi)}
                x2={x(hi)}
                y1={padT}
                y2={padT + ih}
              />
              {series.map((s) => {
                const v = s.values[hi];
                return (
                  v != null && (
                    <circle
                      key={s.name}
                      cx={x(hi)}
                      cy={y(v)}
                      r="3.5"
                      fill={s.color}
                      stroke="var(--surface)"
                      strokeWidth="1.5"
                    />
                  )
                );
              })}
            </g>
          )}
        </svg>
      )}
      {hi != null && w > 0 && (
        <Tip
          x={x(hi)}
          w={w}
          title={titles ? titles[hi] : labels[hi]}
          rows={series.flatMap((s) => {
            const v = s.values[hi];
            return v == null
              ? []
              : [{ name: s.name, color: s.color, value: fmt(v) }];
          })}
        />
      )}
      <ChartDataTable
        label={label}
        labels={titles || labels}
        series={series}
        fmt={fmt}
      />
    </div>
  );
}

export function BarChart({
  labels,
  series,
  height = 220,
  fmt = String,
  fmtAxis = String,
  stacked,
  highlight,
  avg,
  label,
  titles,
  xEvery = 1,
  empty,
}: ChartProps & {
  stacked?: boolean;
  /** Index of the bar to emphasise. */
  highlight?: number | null;
  avg?: number | null;
}) {
  const [ref, w] = useWidth();
  const [hi, setHi] = useState<number | null>(null);
  const padL = 48,
    padR = 10,
    padT = 10,
    padB = 26;
  const totals = labels.map((_, i) =>
    stacked
      ? series.reduce((a, s) => a + Math.max(0, s.values[i] || 0), 0)
      : Math.max(...series.map((s) => s.values[i] || 0)),
  );
  const hasData = totals.some((value) => value !== 0);
  const r = niceRange(0, Math.max(...totals, avg || 0), 4);
  const iw = Math.max(10, w - padL - padR),
    ih = height - padT - padB;
  const n = labels.length;
  const slot = iw / n;
  const groups = stacked ? 1 : series.length;
  const bw = Math.min(28, (slot * 0.62) / groups);
  const y = (v: number) => padT + ih - ((v - r.min) / (r.max - r.min)) * ih;
  if (!hasData)
    return (
      <div className="chart chart-empty" ref={ref} role="status">
        {empty || "No readings yet."}
      </div>
    );
  const axisTicks = r.ticks.filter(
    (tick, index) =>
      index === 0 || fmtAxis(tick) !== fmtAxis(r.ticks[index - 1]),
  );
  return (
    <div className="chart" ref={ref} style={{ height: height + "px" }}>
      {w > 0 && (
        <svg
          width={w}
          height={height}
          role="img"
          aria-label={label}
          onMouseLeave={() => setHi(null)}
        >
          {axisTicks.map((t) => (
            <g key={t}>
              <line
                className="grid"
                x1={padL}
                x2={w - padR}
                y1={Math.round(y(t)) + 0.5}
                y2={Math.round(y(t)) + 0.5}
              />
              <text className="axis" x={padL - 8} y={y(t) + 4} textAnchor="end">
                {fmtAxis(t)}
              </text>
            </g>
          ))}
          {labels.map((l, i) => {
            const cx0 = padL + slot * i + slot / 2;
            let acc = 0;
            const dim = highlight != null && i !== highlight && hi == null;
            return (
              <g key={i} onMouseEnter={() => setHi(i)}>
                <rect
                  x={padL + slot * i}
                  y={padT}
                  width={slot}
                  height={ih}
                  fill="transparent"
                />
                {series.map((s, k) => {
                  const v = Math.max(0, s.values[i] || 0);
                  const top = stacked ? y(acc + v) : y(v);
                  const bx = stacked
                    ? cx0 - bw / 2
                    : cx0 - (bw * groups) / 2 + k * bw + (groups > 1 ? 1 : 0);
                  const hgt = stacked ? y(acc) - y(acc + v) : y(0) - y(v);
                  acc += v;
                  return (
                    <rect
                      key={s.name}
                      x={bx}
                      y={top}
                      width={Math.max(1, bw - (groups > 1 ? 2 : 0))}
                      height={Math.max(0, hgt)}
                      rx={stacked ? 2 : 4}
                      fill={s.color}
                      fillOpacity={
                        dim ? 0.35 : hi === i || highlight === i ? 1 : 0.85
                      }
                    />
                  );
                })}
                {showLabel(i, n, xEvery) && (
                  <text
                    className="axis"
                    x={cx0}
                    y={height - 6}
                    textAnchor="middle"
                  >
                    {l}
                  </text>
                )}
              </g>
            );
          })}
          {avg != null && (
            <g>
              <line
                x1={padL}
                x2={w - padR}
                y1={y(avg)}
                y2={y(avg)}
                stroke="var(--fg-muted)"
                strokeDasharray="3 4"
              />
              <text
                className="axis halo"
                x={w - padR}
                y={y(avg) - 5}
                textAnchor="end"
              >
                {"Avg "}
                {fmtAxis(avg)}
              </text>
            </g>
          )}
        </svg>
      )}
      {hi != null && w > 0 && (
        <Tip
          x={padL + slot * hi + slot / 2}
          w={w}
          title={titles ? titles[hi] : labels[hi]}
          rows={series.map((s) => ({
            name: s.name,
            color: s.color,
            value: fmt(s.values[hi] || 0),
          }))}
        />
      )}
      <ChartDataTable
        label={label}
        labels={titles || labels}
        series={series}
        fmt={fmt}
      />
    </div>
  );
}
