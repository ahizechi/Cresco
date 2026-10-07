// Form inputs shared by several dialogs.
import { DAY, DOW } from "../core/dates";
import { SYM } from "../core/format";
import { TONES } from "../core/tokens";
import { I } from "./controls";

export function MoneyInput({
  id,
  value,
  onInput,
  cur = "GBP",
  invalid,
}: {
  id: string;
  value: string;
  onInput: (value: string) => void;
  cur?: string;
  invalid?: boolean;
}) {
  return (
    <div className="input-icon">
      <span
        style={{
          position: "absolute",
          left: "10px",
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--fg-muted)",
        }}
      >
        {SYM[cur]}
      </span>
      <input
        id={id}
        className="input num"
        style={{ paddingLeft: "24px" }}
        inputMode="decimal"
        value={value}
        aria-invalid={invalid ? "true" : "false"}
        onInput={(e) => onInput(e.currentTarget.value)}
      />
    </div>
  );
}

export function ToneRow({
  value,
  onChange,
  tones = TONES,
}: {
  value: string;
  onChange: (tone: string) => void;
  /** The colours offered; every tone by default. */
  tones?: readonly string[];
}) {
  return (
    <div
      style={{ display: "flex", gap: "6px" }}
      role="radiogroup"
      aria-label="Colour"
    >
      {tones.map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={value === t ? "true" : "false"}
          aria-label={t}
          className={"tone-" + t}
          onClick={() => onChange(t)}
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "999px",
            border: 0,
            background: "var(--tone)",
            boxShadow:
              value === t
                ? "0 0 0 2px var(--surface), 0 0 0 4px var(--tone)"
                : "none",
          }}
        />
      ))}
    </div>
  );
}

/** Weekday toggles, Monday first; values are weekdays with Sunday 0. */
export function DayChips({
  value,
  onChange,
}: {
  value: number[];
  onChange: (days: number[]) => void;
}) {
  return (
    <div className="daychips">
      {[1, 2, 3, 4, 5, 6, 0].map((d) => (
        <button
          key={d}
          type="button"
          className="daychip"
          aria-pressed={value.includes(d) ? "true" : "false"}
          aria-label={DAY[d]}
          onClick={() =>
            onChange(
              value.includes(d) ? value.filter((x) => x !== d) : [...value, d],
            )
          }
        >
          {DOW[d].slice(0, 2)}
        </button>
      ))}
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button
        type="button"
        aria-label="Decrease"
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <I n="minus" s={14} />
      </button>
      <span>{value}</span>
      <button
        type="button"
        aria-label="Increase"
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <I n="plus" s={14} />
      </button>
    </div>
  );
}
