import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFloating } from "./Floating";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const date = (value: string) => new Date(`${value}T12:00:00Z`);
const key = (value: Date) => value.toISOString().slice(0, 10);
const localToday = () => {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
};
const shift = (value: string, days: number) => {
  const next = date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return key(next);
};
const monthShift = (value: string, months: number) => {
  const start = date(value);
  const day = start.getUTCDate();
  start.setUTCDate(1);
  start.setUTCMonth(start.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  ).getUTCDate();
  start.setUTCDate(Math.min(day, last));
  return key(start);
};
const valid = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(date(value).getTime()) &&
  key(date(value)) === value;
const longDate = (value: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(date(value));
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value || "";
  return `${part("weekday")} ${part("day")} ${part("month").replace("Sept", "Sep")} ${part("year")}`;
};
const buttonDate = (value: string) =>
  date(value).getUTCFullYear() === new Date().getFullYear()
    ? longDate(value).replace(/ \d{4}$/, "")
    : longDate(value);
const monthName = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date(value));

type DateFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  min?: string;
  max?: string;
  disabled?: boolean;
};

export function DateField({
  id,
  value,
  onChange,
  optional = false,
  min,
  max,
  disabled,
}: DateFieldProps) {
  const today = localToday();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(valid(value) ? value : today);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const { popover, position } = useFloating(open, trigger, 280, 360);
  const gridId = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (
        !root.current?.contains(event.target as Node) &&
        !popover.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    const dismiss = () => setOpen(false);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [open]);
  useEffect(() => {
    if (open)
      grid.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus();
  }, [open, active]);
  const allowed = (day: string) => (!min || day >= min) && (!max || day <= max);
  const choose = (day: string) => {
    if (!allowed(day)) return;
    onChange(day);
    setActive(day);
    setOpen(false);
    trigger.current?.focus();
  };
  const first = `${active.slice(0, 7)}-01`;
  const offset = (date(first).getUTCDay() + 6) % 7;
  const start = shift(first, -offset);
  const days = Array.from({ length: 42 }, (_, index) => shift(start, index));
  const keyboard = (event: React.KeyboardEvent) => {
    let next = active;
    if (event.key === "ArrowLeft") next = shift(active, -1);
    else if (event.key === "ArrowRight") next = shift(active, 1);
    else if (event.key === "ArrowUp") next = shift(active, -7);
    else if (event.key === "ArrowDown") next = shift(active, 7);
    else if (event.key === "Home")
      next = shift(active, -(date(active).getUTCDay() + 6) % 7);
    else if (event.key === "End")
      next = shift(active, 6 - ((date(active).getUTCDay() + 6) % 7));
    else if (event.key === "PageUp")
      next = monthShift(active, event.shiftKey ? -12 : -1);
    else if (event.key === "PageDown")
      next = monthShift(active, event.shiftKey ? 12 : 1);
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(active);
      return;
    } else if (event.key === "Escape") {
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
      return;
    } else return;
    event.preventDefault();
    if (allowed(next)) setActive(next);
  };
  return (
    <div className="date-field" ref={root}>
      <button
        id={id}
        ref={trigger}
        type="button"
        className="date-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={gridId}
        aria-label={
          valid(value)
            ? longDate(value)
            : optional
              ? "No date"
              : "Choose a date"
        }
        disabled={disabled}
        onClick={() => {
          setActive(valid(value) ? value : today);
          setOpen(!open);
        }}
      >
        <CalendarDays size={15} aria-hidden="true" />{" "}
        <span>
          {valid(value)
            ? buttonDate(value)
            : optional
              ? "No date"
              : "Choose a date"}
        </span>
      </button>
      {open &&
        createPortal(
          <div
            className="date-popover"
            ref={popover}
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
            }}
            id={gridId}
            role="dialog"
            aria-label="Choose a date"
            onKeyDown={keyboard}
          >
            <div className="date-month">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setActive(monthShift(active, -1))}
              >
                <ChevronLeft size={16} />
              </button>
              <strong>{monthName(active)}</strong>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setActive(monthShift(active, 1))}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div
              className="date-grid"
              ref={grid}
              role="grid"
              aria-label={monthName(active)}
            >
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <span key={day} className="date-weekday">
                  {day}
                </span>
              ))}
              {days.map((day) => (
                <button
                  key={day}
                  type="button"
                  role="gridcell"
                  tabIndex={day === active ? 0 : -1}
                  aria-label={longDate(day)}
                  aria-selected={day === value}
                  data-outside={day.slice(0, 7) !== active.slice(0, 7)}
                  disabled={!allowed(day)}
                  onClick={() => choose(day)}
                >
                  {date(day).getUTCDate()}
                </button>
              ))}
            </div>
            <div className="date-actions">
              <button
                type="button"
                onClick={() => choose(today)}
                disabled={!allowed(today)}
              >
                Today
              </button>
              {optional && (
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                    trigger.current?.focus();
                  }}
                >
                  No date
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export { TimeField } from "./TimeField";
