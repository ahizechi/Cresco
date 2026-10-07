// Small shared controls: icons, buttons, chips, form inputs and meters.
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import { svgChildren } from "../core/dom";
import { clamp, cx } from "../core/format";
import { STATUS, type ChipKind } from "../core/tokens";
import { ICONS, type IconName } from "./icons";
import { useSelectionIndicator } from "./selection-indicator";

export interface IconProps {
  n: IconName;
  s?: number;
  cls?: string;
  sw?: number;
}
export function I({ n, s = 16, cls, sw = 1.75 }: IconProps) {
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx("i", cls)}
      aria-hidden="true"
    >
      {svgChildren(ICONS[n])}
    </svg>
  );
}

/** No variant is the default outlined button. */
export type ButtonVariant =
  "primary" | "danger" | "ghost" | "muted-ghost" | "link";
export interface BtnProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type"
> {
  v?: ButtonVariant | null;
  sm?: boolean;
  icon?: boolean;
  i?: IconName;
  cls?: string;
  type?: "button" | "submit";
}
export function Btn({
  v,
  sm,
  icon,
  i,
  children,
  cls,
  type = "button",
  ...rest
}: BtnProps) {
  return (
    <button
      type={type}
      className={cx("btn", v, sm && "sm", icon && "icon", cls)}
      {...rest}
    >
      {i && <I n={i} s={sm ? 14 : 16} />}
      {children}
    </button>
  );
}

export function Chip({
  k = "neutral",
  dot,
  children,
  title,
}: {
  k?: ChipKind;
  dot?: boolean;
  children?: ReactNode;
  title?: string;
}) {
  return (
    <span
      className={cx("chip", k === "outline" ? "bordered" : k, dot && "dot")}
      title={title}
    >
      {children}
    </span>
  );
}

export function Status({ s, label }: { s: string; label?: string }) {
  const [k, l] = STATUS[s] || ["neutral", s];
  return (
    <Chip k={k} dot>
      {label || l}
    </Chip>
  );
}

export function Switch({
  on,
  onChange,
  label,
  disabled,
  id,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      className="switch"
      aria-checked={on ? "true" : "false"}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
    />
  );
}

export function Check({
  on,
  onChange,
  label,
  mixed,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  label: string;
  mixed?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      className="check"
      aria-checked={mixed ? "mixed" : on ? "true" : "false"}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!on);
      }}
    >
      {(on || mixed) && <I n={mixed ? "minus" : "check"} s={12} sw={2.5} />}
    </button>
  );
}

/** A choice: a bare value, or a value with its label and optional icon. */
export type Option<V extends string = string> =
  V | { v: V; l: ReactNode; i?: IconName };
const optionValue = <V extends string>(o: Option<V>): V =>
  typeof o === "string" ? o : o.v;

export function Seg<V extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: V;
  options: readonly Option<V>[];
  onChange: (value: V) => void;
  label: string;
}) {
  const selection = useSelectionIndicator(value, options.length);
  return (
    <div className="seg" role="group" aria-label={label} ref={selection.root}>
      <span
        className="selection-indicator"
        aria-hidden="true"
        ref={selection.indicator}
      />
      {options.map((o) => {
        const v = optionValue(o);
        return (
          <button
            type="button"
            key={v}
            aria-pressed={value === v ? "true" : "false"}
            onClick={() => onChange(v)}
          >
            {typeof o !== "string" && o.i && <I n={o.i} s={14} />}
            {typeof o === "string" ? o : o.l}
          </button>
        );
      })}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  id,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children?: ReactNode;
  id?: string;
}) {
  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}</label>}
      {children}
      {error ? (
        <div className="field-error">
          <I n="circle-alert" s={14} />
          {error}
        </div>
      ) : (
        hint && <div className="field-hint">{hint}</div>
      )}
    </div>
  );
}

export interface InputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onInput"
> {
  value: string | number;
  onInput: (value: string) => void;
}
export function Input({ value, onInput, ...rest }: InputProps) {
  return (
    <input
      className="input"
      value={value}
      onInput={(e) => onInput(e.currentTarget.value)}
      {...rest}
    />
  );
}

export function Sel<V extends string>({
  value,
  options,
  onChange,
  id,
  cls,
  label,
}: {
  value: V;
  options: readonly Option<V>[];
  onChange: (value: V) => void;
  id?: string;
  cls?: string;
  label?: string;
}) {
  return (
    <select
      id={id}
      aria-label={label}
      className={cx("select", cls)}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value as V)}
    >
      {options.map((o) => {
        const v = optionValue(o);
        return (
          <option key={v} value={v}>
            {typeof o === "string" ? o : o.l}
          </option>
        );
      })}
    </select>
  );
}

export function Bar({
  value,
  max,
  over,
  tone,
  label,
}: {
  value: number;
  max: number;
  over?: boolean;
  tone?: string;
  label?: string;
}) {
  const w = max > 0 ? clamp((value / max) * 100, 0, 100) : 0;
  return (
    <div
      className={cx("bar", over && "over", tone && "tone tone-" + tone)}
      {...(label
        ? {
            role: "progressbar",
            "aria-label": label,
            "aria-valuemin": 0,
            "aria-valuemax": max,
            "aria-valuenow": value,
          }
        : { "aria-hidden": true })}
    >
      <i style={{ width: w + "%" }} />
    </div>
  );
}

export function Tile({
  i,
  tone,
  sm,
  plain,
}: {
  i: IconName;
  tone?: string;
  sm?: boolean;
  plain?: boolean;
}) {
  return (
    <span
      className={cx(
        "tile",
        sm && "sm",
        plain && "plain",
        tone && "tone-" + tone,
      )}
    >
      <I n={i} s={sm ? 14 : 16} />
    </span>
  );
}
