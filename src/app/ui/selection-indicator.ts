import { useLayoutEffect, useRef } from "react";

/** One moving surface; selection and keyboard focus never wait for its animation. */
export function useSelectionIndicator(value: string | null, count: number) {
  const root = useRef<HTMLDivElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const animation = useRef<Animation | null>(null);
  const measure = useRef<() => void>(() => {});

  useLayoutEffect(() => {
    const group = root.current;
    const surface = indicator.current;
    if (!group || !surface) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const forced = matchMedia("(forced-colors: active)");
    let destination = "";
    measure.current = () => {
      const active = group.querySelector<HTMLElement>(
        'button[aria-selected="true"],button[aria-pressed="true"]',
      );
      if (!active) {
        animation.current?.cancel();
        group.removeAttribute("data-indicator-ready");
        surface.style.visibility = "hidden";
        destination = "";
        return;
      }
      const quiet =
        (reduced.matches && document.documentElement.dataset.motion !== "on") ||
        forced.matches ||
        document.documentElement.dataset.motion === "reduced";
      const next = `${active.offsetLeft}:${active.offsetWidth}`;
      if (next === destination) {
        if (quiet) animation.current?.cancel();
        return;
      }
      const previous = new DOMMatrixReadOnly(
        getComputedStyle(surface).transform,
      );
      const previousWidth = surface.offsetWidth * previous.a;
      const ready = !!destination;
      animation.current?.cancel();
      surface.style.width = `${active.offsetWidth}px`;
      const target = `translateX(${active.offsetLeft}px) scaleX(1)`;
      surface.style.transform = target;
      surface.style.visibility = "visible";
      group.dataset.indicatorReady = "true";
      destination = next;
      if (ready && !quiet && active.offsetWidth > 0) {
        animation.current = surface.animate(
          [
            {
              transform: `translateX(${previous.e}px) scaleX(${previousWidth / active.offsetWidth})`,
            },
            { transform: target },
          ],
          { duration: 170, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
        );
      }
    };
    const observer = new ResizeObserver(() => measure.current());
    observer.observe(group);
    group
      .querySelectorAll("button")
      .forEach((button) => observer.observe(button));
    const preferences = new MutationObserver(() => measure.current());
    preferences.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-motion"],
    });
    const changed = () => measure.current();
    reduced.addEventListener("change", changed);
    forced.addEventListener("change", changed);
    measure.current();
    return () => {
      animation.current?.cancel();
      observer.disconnect();
      preferences.disconnect();
      reduced.removeEventListener("change", changed);
      forced.removeEventListener("change", changed);
      measure.current = () => {};
    };
  }, [count]);
  useLayoutEffect(() => measure.current(), [value]);
  return { root, indicator };
}
