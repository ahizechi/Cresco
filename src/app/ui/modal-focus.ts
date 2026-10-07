import { useLayoutEffect, useRef, type KeyboardEvent } from "react";

/** Keeps modal keyboard focus inside and returns it to the control that opened it. */
export function useModalFocus<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    // StrictMode runs layout effects twice; the original opener must survive that replay.
    if (!openerRef.current && document.activeElement instanceof HTMLElement)
      openerRef.current = document.activeElement;
    const root = ref.current;
    const initial =
      root?.querySelector<HTMLElement>(
        "input:not([type=hidden]),select,textarea",
      ) ||
      root?.querySelector<HTMLElement>(".dialog-foot .btn.primary") ||
      root?.querySelector<HTMLElement>("button");
    (initial || root)?.focus({ preventScroll: true });
    return () => {
      requestAnimationFrame(() => {
        const modal = Array.from(
          document.querySelectorAll<HTMLElement>('[aria-modal="true"]'),
        )
          .filter((node) => !node.closest('[inert],[aria-hidden="true"]'))
          .at(-1);
        if (
          openerRef.current?.isConnected &&
          (!modal || modal.contains(openerRef.current))
        )
          openerRef.current.focus({ preventScroll: true });
        else if (modal && !modal.contains(document.activeElement))
          (
            modal.querySelector<HTMLElement>("button,input,select,textarea") ??
            modal
          ).focus({ preventScroll: true });
      });
    };
  }, []);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const nodes = Array.from(
      ref.current?.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((node) => node.getClientRects().length > 0);
    if (!nodes.length) {
      event.preventDefault();
      ref.current?.focus({ preventScroll: true });
      return;
    }
    const first = nodes[0],
      last = nodes[nodes.length - 1];
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        !ref.current?.contains(document.activeElement))
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === last ||
        !ref.current?.contains(document.activeElement))
    ) {
      event.preventDefault();
      first.focus();
    }
  };
  return { ref, onKeyDown };
}
