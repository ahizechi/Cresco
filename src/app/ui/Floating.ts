import { useLayoutEffect, useRef, useState, type RefObject } from "react";

export function useFloating(
  open: boolean,
  anchor: RefObject<HTMLElement | null>,
  width: number,
  height: number,
) {
  const popover = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width });
  useLayoutEffect(() => {
    if (!open || !anchor.current || !popover.current) return;
    const rect = anchor.current.getBoundingClientRect();
    const actualHeight =
      popover.current.getBoundingClientRect().height || height;
    const actualWidth = Math.min(
      Math.max(width, rect.width),
      window.innerWidth - 16,
    );
    const below = window.innerHeight - rect.bottom - 8;
    const above = rect.top - 8;
    const top =
      below >= actualHeight || below >= above
        ? Math.min(rect.bottom + 6, window.innerHeight - actualHeight - 8)
        : Math.max(8, rect.top - actualHeight - 6);
    setPosition({
      top: Math.max(8, top),
      left: Math.max(
        8,
        Math.min(rect.left, window.innerWidth - actualWidth - 8),
      ),
      width: actualWidth,
    });
  }, [open, anchor, width, height]);
  return { popover, position };
}
