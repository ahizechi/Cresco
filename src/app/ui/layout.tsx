import type { ReactNode } from "react";
import { css } from "../core/dom";
import { cx } from "../core/format";
import { S, closeDialog, closeSheet, updateView } from "../core/state";
import { Btn, I, Tile } from "./controls";
import type { IconName } from "./icons";
import { Spark } from "./spark";
import { useModalFocus } from "./modal-focus";

export interface EmptyProps {
  icon?: IconName;
  title: ReactNode;
  text?: ReactNode;
  action?: ReactNode;
}
export function Empty({
  icon = "circle-dashed",
  title,
  text,
  action,
}: EmptyProps) {
  return (
    <div className="empty">
      <Tile i={icon} plain />
      <div className="empty-title">{title}</div>
      {text && <p>{text}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

export function ErrorBox({
  title = "Cresco couldn't read this section.",
  text = "Your saved data has not changed. Try again, or export diagnostics from Settings if it keeps happening.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="err" role="alert">
      <I n="circle-alert" />
      <div className="error-copy">
        <p className="strong">{title}</p>
        <p className="muted">{text}</p>
      </div>
      <Btn
        sm
        onClick={() =>
          updateView((view) => {
            view.preview = "populated";
          })
        }
      >
        Retry
      </Btn>
    </div>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rows" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div className="row" key={i}>
          <div className="skel skel-tile" />
          <div className="row-main skel-copy">
            <div className={cx("skel", "skel-line-" + (i % 3))} />
            <div className="skel skel-subline" />
          </div>
          <div className="skel skel-end" />
        </div>
      ))}
    </div>
  );
}

export interface PanelProps {
  title?: ReactNode;
  detail?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  flush?: boolean;
  /** Shows the loading, error or empty state instead of the body in previews. */
  list?: boolean;
  empty?: EmptyProps;
  isEmpty?: boolean;
  cls?: string;
  style?: string;
  id?: string;
}
export function Panel({
  title,
  detail,
  actions,
  children,
  flush,
  list,
  empty,
  isEmpty,
  cls,
  style,
  id,
}: PanelProps) {
  let body = children;
  if (list && (S.preview !== "populated" || isEmpty)) {
    body =
      S.preview === "loading" ? (
        <div className={flush ? "panel-skeleton-flush" : undefined}>
          <Skeleton />
        </div>
      ) : S.preview === "error" ? (
        <div className={flush ? "panel-error-flush" : undefined}>
          <ErrorBox />
        </div>
      ) : (
        <Empty {...(empty || { title: "Nothing here yet" })} />
      );
  }
  return (
    <section
      className={cx("panel", flush && "flush", cls)}
      style={css(style)}
      id={id}
    >
      {(title || actions) && (
        <div className="panel-head">
          <div>
            {title && <h2 className="panel-title">{title}</h2>}
            {detail && <p className="panel-detail">{detail}</p>}
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </div>
      )}
      {body}
    </section>
  );
}

export interface StatProps {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  trend?: "up" | "down" | "flat" | null;
  tone?: "pos" | "neg" | string | null;
  spark?: number[] | null;
  sparkColor?: string;
  icon?: IconName;
  onClick?: () => void;
}
export function Stat({
  label,
  value,
  note,
  trend,
  tone,
  spark,
  sparkColor,
  icon,
  onClick,
}: StatProps) {
  if (S.preview === "loading")
    return (
      <div className="stat">
        <div className="stat-label">{label}</div>
        <div className="stat-skeleton-copy">
          <div className="skel stat-skeleton-value" />
          <div className="skel stat-skeleton-note" />
        </div>
      </div>
    );
  const blank = S.preview !== "populated";
  const color =
    sparkColor ||
    (tone === "neg"
      ? "var(--danger)"
      : tone === "pos"
        ? "var(--success)"
        : "var(--fg-subtle)");
  const inner = (
    <>
      <div className="stat-label">
        {icon && <Tile i={icon} sm plain />}
        <span className="stat-name">{label}</span>
        {onClick && <I n="chevron-right" s={14} cls="stat-go" />}
      </div>
      <div>
        <div className="stat-value">{blank ? "—" : value}</div>
        <div className={cx("stat-note", !blank && tone)}>
          {blank ? (
            S.preview === "error" ? (
              "Couldn't read"
            ) : (
              "No data yet"
            )
          ) : (
            <>
              {trend && (
                <I
                  n={
                    trend === "up"
                      ? "trending-up"
                      : trend === "down"
                        ? "trending-down"
                        : "minus"
                  }
                  s={13}
                />
              )}
              {note}
            </>
          )}
        </div>
      </div>
      {spark && !blank && (
        <div className="stat-spark">
          <Spark values={spark} color={color} />
        </div>
      )}
    </>
  );
  return onClick ? (
    <button type="button" className="stat" onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className="stat">{inner}</div>
  );
}

export function Dialog({
  title,
  desc,
  children,
  foot,
  wide,
  xwide,
  onClose = closeDialog,
  label,
}: {
  title: ReactNode;
  desc?: ReactNode;
  children?: ReactNode;
  foot?: ReactNode;
  wide?: boolean;
  xwide?: boolean;
  onClose?: () => void;
  label?: string;
}) {
  const { ref, onKeyDown } = useModalFocus<HTMLDivElement>(onClose);
  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={cx("dialog", wide && "wide", xwide && "xwide")}
        role="dialog"
        aria-modal="true"
        aria-label={label || (typeof title === "string" ? title : undefined)}
        ref={ref}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="dialog-head">
          <div>
            <h2 className="dialog-title">{title}</h2>
            {desc && <p className="dialog-desc">{desc}</p>}
          </div>
          <Btn
            v="muted-ghost"
            sm
            icon
            i="x"
            aria-label="Close"
            onClick={onClose}
          />
        </div>
        <div className="dialog-body">{children}</div>
        {foot && <div className="dialog-foot">{foot}</div>}
      </div>
    </div>
  );
}

export function Sheet({
  title,
  desc,
  children,
  foot,
  onClose = closeSheet,
}: {
  title: string;
  desc?: ReactNode;
  children?: ReactNode;
  foot?: ReactNode;
  onClose?: () => void;
}) {
  const { ref, onKeyDown } = useModalFocus<HTMLElement>(onClose);
  return (
    <div
      className="overlay sheet-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="dialog-head">
          <div>
            <h2 className="dialog-title">{title}</h2>
            {desc && <p className="dialog-desc">{desc}</p>}
          </div>
          <Btn
            v="muted-ghost"
            sm
            icon
            i="x"
            aria-label="Close"
            onClick={onClose}
          />
        </div>
        <div className="sheet-body">{children}</div>
        {foot && <div className="dialog-foot">{foot}</div>}
      </aside>
    </div>
  );
}

export { RowMenu, Source, Row } from "./rows";
