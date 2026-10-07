import { createElement, type CSSProperties, type ReactNode } from "react";

const RENAMES: Record<string, string> = {
  class: "className",
  for: "htmlFor",
  colspan: "colSpan",
  inputmode: "inputMode",
  tabindex: "tabIndex",
  maxlength: "maxLength",
};

/** Converts an inline `a:b;c-d:e` declaration list into a React style object. */
export function css(
  style: string | CSSProperties | null | undefined | false,
): CSSProperties | undefined {
  if (!style) return undefined;
  if (typeof style !== "string") return style;
  const out: Record<string, string> = {};
  for (const part of style.split(";")) {
    const at = part.indexOf(":");
    if (at < 0) continue;
    const key = part.slice(0, at).trim();
    out[
      key.startsWith("--")
        ? key
        : key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
    ] = part.slice(at + 1).trim();
  }
  return out as CSSProperties;
}

/** A style that also sets CSS custom properties such as `--c`. */
export const vars = (
  style: CSSProperties & Record<`--${string}`, string | number | undefined>,
): CSSProperties => style;

/** Normalises HTML-style attribute names in props spread onto a DOM element. */
export function domProps<T extends object>(props: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    const name =
      RENAMES[key] ??
      (key.includes("-") && !key.startsWith("aria-") && !key.startsWith("data-")
        ? key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
        : key);
    out[name] = name === "style" ? css(value as string) : value;
  }
  return out as T;
}

export type SvgNode = [string, Record<string, string | number>];

/** Renders icon path data as SVG children. */
export function svgChildren(nodes: SvgNode[]): ReactNode[] {
  return nodes.map(([tag, attrs], index) =>
    createElement(tag, { ...domProps(attrs), key: index }),
  );
}
