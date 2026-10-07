// The page title and its tab strip: the one owner of the page <h1> and tablist.
import type { KeyboardEvent, ReactNode } from "react";
import { S, go } from "../core/state";
import { PAGES } from "../core/routes";
import { useSelectionIndicator } from "./selection-indicator";

export function PageHead({
  title,
  sub,
  actions,
  counts = {},
  tabs,
  tabsLabel,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  /** Attention counts shown on tabs, by tab id. */
  counts?: Record<string, number>;
  /** Tabs of a view below the page, such as one bot's detail, in place of the page's own. */
  tabs?: readonly { id: string; label: string }[];
  tabsLabel?: string;
}) {
  const id = S.route.page;
  const page = PAGES[id];
  const list = tabs ?? page.tabs;
  const selection = useSelectionIndicator(S.route.tab, list?.length ?? 0);
  // Left and right arrows move between tabs, as in the ARIA tabs pattern.
  function arrow(event: KeyboardEvent<HTMLButtonElement>) {
    if (
      !list ||
      !["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)
    )
      return;
    event.preventDefault();
    const i = list.findIndex((t) => t.id === S.route.tab);
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const step = (event.key === "ArrowRight") !== rtl ? 1 : list.length - 1;
    const index =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? list.length - 1
          : (i + step) % list.length;
    const next = list[index].id;
    go(id, next);
    requestAnimationFrame(() => {
      const button = document.querySelector<HTMLElement>(
        `[role="tab"][data-tab="${next}"]`,
      );
      button?.focus({ preventScroll: true });
      button?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }
  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">{title || page.label}</h1>
          {sub && <p className="page-sub">{sub}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
      {list && list.length > 0 && (
        <div
          className="tabs"
          role="tablist"
          aria-label={tabsLabel ?? page.label + " sections"}
          ref={selection.root}
        >
          <span
            className="selection-indicator"
            aria-hidden="true"
            ref={selection.indicator}
          />
          {list.map((t) => {
            const n = S.preview === "populated" ? counts[t.id] || 0 : 0;
            return (
              <button
                type="button"
                role="tab"
                key={t.id}
                data-tab={t.id}
                className="tab"
                aria-selected={S.route.tab === t.id ? "true" : "false"}
                tabIndex={S.route.tab === t.id ? 0 : -1}
                onClick={() => go(id, t.id)}
                onKeyDown={arrow}
              >
                {t.label}
                {n ? (
                  <span className="attention-dot" aria-label="needs you" />
                ) : (
                  ""
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
