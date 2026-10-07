// Small charts and the scale helpers shared with the full charts.
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { vars } from "../core/dom";
import { clamp, cx } from "../core/format";

/** A series drawn by LineChart or BarChart. Missing values are null. */
export interface Series {
  name: string;
  color: string;
  values: (number | null)[];
  fillOpacity?: number;
  dashed?: boolean;
}
export interface ChartProps {
  labels: readonly string[];
  series: Series[];
  height?: number;
  fmt?: (value: number) => string;
  fmtAxis?: (value: number) => string;
  xEvery?: number;
  label?: string;
  titles?: readonly string[];
  empty?: string;
}
export const showLabel = (i: number, n: number, every: number) =>
  (i % every === 0 && n - 1 - i >= every / 2) || i === n - 1;

/** Tracks an element's rendered width. */
export function useWidth<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) =>
      setW(Math.round(e.contentRect.width)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function niceStep(raw: number) {
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
}

/** Rounds a value range out to tidy axis ticks. */
export function niceRange(lo: number, hi: number, n = 4) {
  if (hi === lo) hi = lo + 1;
  const step = niceStep((hi - lo) / n);
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(+v.toFixed(6));
  return { min, max, ticks };
}

export function Spark({
  values,
  color = "var(--success)",
  w = 84,
  h = 34,
}: {
  values: number[];
  color?: string;
  w?: number;
  h?: number;
}) {
  if (!values.length || values.some((value) => !Number.isFinite(value)))
    return null;
  const lo = Math.min(...values),
    hi = Math.max(...values);
  const x = (i: number) =>
    values.length === 1 ? w / 2 : 1 + (i * (w - 4)) / (values.length - 1);
  const y = (v: number) => 3 + (h - 6) * (1 - (v - lo) / (hi - lo || 1));
  const line = values
    .map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1))
    .join("");
  const last = values.length - 1;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path
        d={line + `L${x(last)} ${h}L${x(0)} ${h}Z`}
        fill={color}
        fillOpacity="0.1"
        stroke="none"
      />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={x(last)} cy={y(values[last])} r="2.5" fill={color} />
    </svg>
  );
}

export function Tip({
  x,
  w,
  title,
  rows,
}: {
  x: number;
  w: number;
  title: ReactNode;
  rows: { name: string; color: string; value: ReactNode }[];
}) {
  const flip = x > w - 170;
  return (
    <div
      className="chart-tip"
      style={{
        left: (flip ? x - 12 : x + 12) + "px",
        top: "6px",
        transform: flip ? "translateX(-100%)" : "none",
      }}
    >
      <b>{title}</b>
      {rows.map((r) => (
        <div key={r.name}>
          <span className="swatch" style={vars({ "--c": r.color })} />
          <span>{r.name}</span>
          <span>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** The chart's values as a screen-reader table. */
export function ChartDataTable({
  label,
  labels,
  series,
  fmt,
}: {
  label?: string;
  labels: readonly string[];
  series: Series[];
  fmt: (value: number) => string;
}) {
  return (
    <table className="sr-only">
      <caption>
        {label || "Chart"}
        {" values"}
      </caption>
      <thead>
        <tr>
          <th scope="col">Time or category</th>
          {series.map((item) => (
            <th key={item.name} scope="col">
              {item.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {labels.map((entry, index) => {
          return (
            <tr key={index}>
              <th scope="row">{entry}</th>
              {series.map((item) => {
                const value = item.values[index];
                return (
                  <td key={item.name}>
                    {value == null ? "Unavailable" : fmt(value)}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function Donut({
  parts,
  size = 132,
  thick = 14,
  children,
}: {
  parts: { label: string; value: number; color: string }[];
  size?: number;
  thick?: number;
  children?: ReactNode;
}) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const rr = (size - thick) / 2,
    c = 2 * Math.PI * rr;
  let off = 0;
  return (
    <div
      style={{
        position: "relative",
        width: size + "px",
        height: size + "px",
        flex: "none",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={parts
          .map((p) => p.label + " " + Math.round((p.value / total) * 100) + "%")
          .join(", ")}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={rr}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={thick}
        />
        {parts.map((p) => {
          const len = (p.value / total) * c;
          const el = (
            <circle
              key={p.label}
              cx={size / 2}
              cy={size / 2}
              r={rr}
              fill="none"
              stroke={p.color}
              strokeWidth={thick}
              strokeDasharray={`${Math.max(0, len - 2)} ${c}`}
              strokeDashoffset={-off}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          off += len;
          return el;
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: "0",
          display: "grid",
          placeItems: "center",
          textAlign: "center",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function Ring({
  value,
  size = 36,
  stroke = 4,
  tone,
}: {
  /** Progress from 0 to 1. */
  value: number;
  size?: number;
  stroke?: number;
  tone?: string;
}) {
  const rr = (size - stroke) / 2,
    c = 2 * Math.PI * rr;
  return (
    <svg
      className={cx("progress-ring", tone && "tone-" + tone)}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={rr}
        fill="none"
        stroke={
          tone
            ? "color-mix(in srgb, var(--tone) var(--tint), transparent)"
            : "var(--muted)"
        }
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={rr}
        fill="none"
        stroke={tone ? "var(--tone)" : "var(--primary)"}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${c * clamp(value, 0, 1)} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

export function HBars({
  items,
  fmt,
  fmtAxis,
  color = "var(--series-2)",
}: {
  items: { label: string; value: number; color?: string }[];
  fmt: (value: number) => string;
  fmtAxis: (value: number) => string;
  color?: string;
}) {
  const r = niceRange(0, Math.max(...items.map((i) => i.value), 1), 4);
  return (
    <div className="hbars">
      {items.map((it) => (
        <div className="hbar" key={it.label}>
          <div className="hbar-label" title={it.label}>
            {it.label}
          </div>
          <div className="hbar-track">
            <i
              style={{
                width: (it.value / r.max) * 100 + "%",
                background: it.color || color,
              }}
            />
          </div>
          <div className="hbar-val">{fmt(it.value)}</div>
        </div>
      ))}
      <div className="hbar-axis">
        <span />
        <div>
          {r.ticks.map((t) => (
            <span key={t}>{fmtAxis(t)}</span>
          ))}
        </div>
        <span />
      </div>
    </div>
  );
}
