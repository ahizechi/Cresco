// One habit's check-in row and its week of dots, shared by Home and Habits.
import { DOW, TODAY, addDays, dmed, dow } from "../core/dates";
import { cx } from "../core/format";
import { apply } from "../core/commands";
import { S, openDialog } from "../core/state";
import type { HabitRow as Habit, MenuItem } from "../core/view";
import { Bar, Check, I, Tile } from "../ui/controls";
import { RowMenu } from "../ui/layout";
import { clearDay, setValue } from "./commands";
import {
  dayStatus,
  hkey,
  hrec,
  hsched,
  hskip,
  hval,
  streak,
  unitText,
} from "./selectors";

export const setHabit = (hb: Habit, day: string, value: number) =>
  void apply(
    setValue(hb, day, value),
    value >= hb.target ? "Habit completed" : "Progress saved",
    { undo: true },
  );

export function habitMenu(hb: Habit, day: string): MenuItem[] {
  const items: MenuItem[] = [
    {
      l: day === TODAY ? "Log details…" : "Correct this day…",
      i: "pencil",
      f: () => openDialog("habitDay", { hb, d: day }),
    },
    {
      l: "Skip with a note…",
      i: "skip-forward",
      f: () => openDialog("habitDay", { hb, d: day, skip: true }),
    },
  ];
  if (hrec(hb, day))
    items.push(
      { sep: true },
      {
        l: "Clear check-in",
        i: "eraser",
        f: () =>
          void apply(clearDay(hb, day), "Check-in cleared", { undo: true }),
      },
    );
  return items;
}

export function HabitRow({
  hb,
  date = TODAY,
  compact,
}: {
  hb: Habit;
  date?: string;
  compact?: boolean;
}) {
  const v = hval(hb.id, date);
  const done = v >= hb.target;
  const counted = hb.kind === "count" || (hb.kind == null && hb.target > 1);
  const sk = hskip(hb, date);
  const note = S.hnote[hkey(hb.id, date)];
  const st = streak(hb);
  return (
    <div className={cx("habit", done && "done", "tone-" + hb.tone)}>
      <Tile i={hb.icon} tone={hb.tone} />
      <div className="habit-top">
        <span className="habit-name">
          {hb.name}
          {!compact && date === TODAY && st > 1 && (
            <span className="meta">{` · ${st} day streak`}</span>
          )}
        </span>
        <span className="num">{sk != null ? "Skipped" : unitText(hb, v)}</span>
      </div>
      {sk != null ? (
        <div className="row-sub habit-sub">
          <I n="skip-forward" s={12} />
          {` ${sk || "Skipped without a note"}`}
        </div>
      ) : (
        <Bar
          value={v}
          max={hb.target}
          tone={hb.tone}
          label={hb.name + " progress"}
        />
      )}
      {note && sk == null && !compact && (
        <div className="row-sub habit-sub">{note}</div>
      )}
      <div className="row-end">
        {counted && sk == null && (
          <div className="quick">
            <button
              type="button"
              aria-label={`Remove ${hb.step} ${hb.unit}`}
              onClick={() => setHabit(hb, date, v - hb.step)}
            >
              <I n="minus" s={14} />
            </button>
            <button
              type="button"
              aria-label={`Add ${hb.step} ${hb.unit}`}
              onClick={() => setHabit(hb, date, v + hb.step)}
            >
              {`+${hb.step}`}
            </button>
          </div>
        )}
        {counted ? (
          <span
            className={cx("check", "check-static", done && "on")}
            role="img"
            aria-label={`${hb.name}: ${done ? "target met" : "target not yet met"}`}
          >
            {done && <I n="check" s={12} sw={2.5} />}
          </span>
        ) : (
          <Check
            on={done}
            label={(done ? "Mark not done: " : "Complete: ") + hb.name}
            onChange={(on) =>
              setHabit(hb, date, on ? Math.max(v, hb.target) : 0)
            }
          />
        )}
        {!compact && (
          <RowMenu label={"More for " + hb.name} items={habitMenu(hb, date)} />
        )}
      </div>
    </div>
  );
}

export function WeekDots({ hb, mon }: { hb: Habit; mon: string }) {
  return (
    <div className={cx("week-dots", "tone-" + hb.tone)}>
      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(mon, i);
        const v = hval(hb.id, d);
        const level = !hsched(hb, d)
          ? "off"
          : d > TODAY
            ? ""
            : v >= hb.target
              ? "on"
              : v > 0
                ? "part"
                : "";
        return (
          <span
            key={d}
            className={cx("wd tone", level, d === TODAY && "today")}
            title={dmed(d) + ": " + dayStatus(hb, d)[0]}
          >
            {DOW[dow(d)][0]}
          </span>
        );
      })}
    </div>
  );
}
