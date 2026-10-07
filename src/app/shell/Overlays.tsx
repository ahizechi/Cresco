// The anchored row menu and the toast stack.
import { useLayoutEffect, useRef, type KeyboardEvent } from "react";
import { clamp, cx } from "../core/format";
import {
  S,
  dismissToast,
  pauseToast,
  resumeToast,
  updateView,
} from "../core/state";
import type { OpenMenu } from "../core/view";
import { Btn, I } from "../ui/controls";

const closeMenu = () =>
  updateView((view) => {
    view.ui.menu = null;
  });

export function MenuLayer({ m }: { m: OpenMenu }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth,
      hh = el.offsetHeight,
      W = window.innerWidth,
      H = window.innerHeight;
    let left, top;
    if (m.sub) {
      left = m.r.right + 4;
      if (left + w > W - 8) left = m.r.left - w - 4;
      top = m.r.top - 4;
    } else {
      left = m.align === "start" ? m.r.left : m.r.right - w;
      top = m.r.bottom + 4;
      if (top + hh > H - 8) top = m.r.top - hh - 4;
    }
    el.style.left = clamp(left, 8, W - w - 8) + "px";
    el.style.top = clamp(top, 8, H - hh - 8) + "px";
    el.style.visibility = "visible";
    el.querySelector<HTMLElement>(".menu-item:not([disabled])")?.focus({
      preventScroll: true,
    });
  }, [m]);
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [
      ...e.currentTarget.querySelectorAll<HTMLElement>(
        ".menu-item:not([disabled])",
      ),
    ];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Tab") {
      e.preventDefault();
      closeMenu();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      items[e.key === "Home" ? 0 : items.length - 1]?.focus();
    }
  };
  return (
    <div
      className="menu"
      role="menu"
      ref={ref}
      style={{ visibility: "hidden" }}
      onKeyDown={key}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {m.items.map((it, i) =>
        it.sep ? (
          <div className="menu-sep" key={i} role="separator" />
        ) : it.head ? (
          <div className="menu-label" key={i}>
            {it.head}
          </div>
        ) : (
          <button
            type="button"
            key={i}
            className={cx("menu-item", it.danger && "danger")}
            role={it.checked != null ? "menuitemradio" : "menuitem"}
            aria-checked={it.checked != null ? it.checked : undefined}
            disabled={it.disabled}
            onClick={(e) => {
              if (it.sub) return it.f?.(e);
              closeMenu();
              it.f?.(e);
            }}
          >
            {it.i && <I n={it.i} s={15} />}
            <span style={{ flex: "1" }}>{it.l}</span>
            {it.sub && <I n="chevron-right" s={14} />}
          </button>
        ),
      )}
    </div>
  );
}

export function Toasts() {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {S.toasts.map((t) => (
        <div
          className="toast"
          key={t.id}
          role={t.error ? "alert" : undefined}
          onPointerEnter={() => pauseToast(t.id, "pointer")}
          onPointerLeave={() => resumeToast(t.id, "pointer")}
          onFocusCapture={() => pauseToast(t.id, "focus")}
          onBlurCapture={(event) => {
            if (
              !event.currentTarget.contains(event.relatedTarget as Node | null)
            )
              resumeToast(t.id, "focus");
          }}
        >
          <I n={t.error ? "circle-alert" : "circle-check"} />
          <p>{t.msg}</p>
          {t.undo && (
            <Btn
              sm
              v="ghost"
              onClick={() => {
                dismissToast(t.id);
                t.undo?.();
              }}
            >
              Undo
            </Btn>
          )}
          <Btn
            sm
            icon
            v="muted-ghost"
            i="x"
            aria-label="Dismiss"
            onClick={() => dismissToast(t.id)}
          />
        </div>
      ))}
    </div>
  );
}
