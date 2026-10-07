import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock3 } from "lucide-react";
import { useFloating } from "./Floating";

const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
type TimeFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  disabled?: boolean;
};
export function TimeField({
  id,
  value,
  onChange,
  optional = false,
  disabled,
}: TimeFieldProps) {
  const [draft, setDraft] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const { popover, position } = useFloating(open, input, 180, 192);
  const options = Array.from(
    { length: 96 },
    (_, index) =>
      `${String(Math.floor(index / 4)).padStart(2, "0")}:${String((index % 4) * 15).padStart(2, "0")}`,
  );
  const [active, setActive] = useState(Math.max(0, options.indexOf(value)));
  useEffect(() => setDraft(value || ""), [value]);
  // Opening shows the current time, not the top of the day.
  useEffect(() => {
    const list = popover.current;
    const item = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (open && list && item)
      list.scrollTop =
        item.offsetTop - (list.clientHeight - item.offsetHeight) / 2;
  }, [open, active]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (
        !root.current?.contains(event.target as Node) &&
        !popover.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    // Scrolling the list itself keeps it open; scrolling the page closes it.
    const dismiss = (event: Event) => {
      if (!popover.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [open]);
  const choose = (time: string) => {
    setDraft(time);
    setError(false);
    onChange(time);
    setOpen(false);
    input.current?.focus();
  };
  return (
    <div className="time-field" ref={root}>
      <div className="time-control">
        <Clock3 size={15} aria-hidden="true" />
        <input
          id={id}
          ref={input}
          type="text"
          inputMode="numeric"
          placeholder={optional ? "Optional" : "HH:mm"}
          value={draft}
          disabled={disabled}
          aria-invalid={error}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={`${id}-suggestions`}
          // Focus alone (a dialog focusing its first field) must not open the
          // list over the dialog's buttons; a click or the arrow keys do.
          onClick={() => {
            setActive(Math.max(0, options.indexOf(draft)));
            setOpen(true);
          }}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            setError(false);
            if (validTime(next)) onChange(next);
          }}
          onBlur={() => {
            if (draft && validTime(draft)) onChange(draft);
            else if (!draft && optional) onChange("");
            else setError(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setOpen(false);
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActive((active + 1) % options.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActive((active + options.length - 1) % options.length);
            } else if (event.key === "Enter") {
              event.preventDefault();
              if (validTime(draft)) choose(draft);
              else choose(options[active]);
            }
          }}
        />
        {optional && draft && (
          <button
            type="button"
            aria-label="Clear time"
            onClick={() => choose("")}
          >
            Clear
          </button>
        )}
      </div>
      {error && (
        <span className="time-error" role="alert">
          Use 24-hour time, HH:mm.
        </span>
      )}
      {open &&
        createPortal(
          <div
            className="time-suggestions"
            ref={popover}
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
            }}
            id={`${id}-suggestions`}
            role="listbox"
            aria-label="Time suggestions"
          >
            {options.map((time, index) => (
              <button
                key={time}
                type="button"
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(time)}
              >
                {time}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
