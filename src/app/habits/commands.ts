// Habit changes. Real mode writes the encrypted habit store through the
// domain functions; schedule changes start a new rule from today so earlier
// days keep the rules they had.
import {
  changeRule,
  putEntry,
  type Habit,
  type HabitData,
  type HabitRule,
} from "../../features/habits/model";
import { PAUSE_UNTIL_RESUMED, resumeHabit } from "../../features/habits/pause";
import { write, type Change } from "../core/commands";
import { TODAY, addDays } from "../core/dates";
import { clamp } from "../core/format";
import { nid } from "../core/state";
import type { HabitRow, ViewState } from "../core/view";
import { hkey } from "./selectors";

type Store = (data: HabitData) => HabitData;
const store =
  (change: Store): Change["real"] =>
  ({ habits }) =>
    write(habits, change);

const habitIn = (data: HabitData, id: string) => {
  const habit = data.habits.find((h) => h.id === id);
  if (!habit) throw new Error("This habit is no longer available.");
  return habit;
};
const replace = (data: HabitData, habit: Habit): HabitData => ({
  ...data,
  habits: data.habits.map((h) => (h.id === habit.id ? habit : h)),
});
const viewHabit = (view: ViewState, id: string) =>
  view.habits.find((h) => h.id === id);
const clearKey = (view: ViewState, key: string) => {
  delete view.hlog[key];
  delete view.hskip[key];
  delete view.hnote[key];
};
const LOG_KEYS = ["hlog", "hskip", "hnote"] as const;

/* ---------- check-ins ---------- */

/** Sets a day's amount, clearing a skip and keeping its note. */
export function setValue(hb: HabitRow, day: string, value: number): Change {
  const v = clamp(value, 0, 1000000);
  return {
    sample: (view) => {
      const key = hkey(hb.id, day);
      delete view.hskip[key];
      view.hlog[key] = v;
    },
    real: store((data) => {
      const old = data.entries.find(
        (e) => e.habitId === hb.id && e.date === day,
      );
      return putEntry(data, {
        habitId: hb.id,
        date: day,
        value: v,
        skipped: false,
        note: old && !old.skipped ? old.note : "",
      });
    }),
  };
}

export interface DayInput {
  skip: boolean;
  value: number;
  note: string;
}

/** Logs progress with a note, or skips the day with a reason. */
export function logDay(hb: HabitRow, day: string, input: DayInput): Change {
  const note = input.note.trim();
  const value = input.skip ? 0 : clamp(input.value, 0, 1000000);
  return {
    sample: (view) => {
      const key = hkey(hb.id, day);
      clearKey(view, key);
      if (input.skip) view.hskip[key] = note;
      else {
        view.hlog[key] = value;
        if (note) view.hnote[key] = note;
      }
    },
    real: store((data) =>
      putEntry(data, {
        habitId: hb.id,
        date: day,
        value,
        skipped: input.skip,
        note,
      }),
    ),
  };
}

export function clearDay(hb: HabitRow, day: string): Change {
  return {
    keys: [...LOG_KEYS],
    sample: (view) => clearKey(view, hkey(hb.id, day)),
    real: store((data) => ({
      ...data,
      entries: data.entries.filter(
        (e) => e.habitId !== hb.id || e.date !== day,
      ),
    })),
  };
}

/* ---------- habits ---------- */

export interface HabitInput {
  name: string;
  /** Sample only; saved habits have no icon. */
  icon: HabitRow["icon"];
  tone: string;
  kind: "count" | "check";
  target: number;
  unit: string;
  step: number;
  /** Weekdays, Sunday 0. */
  days: number[];
  tod: HabitRow["tod"];
  cat: string;
  why: string;
  /** The first day; used when adding. */
  created: string;
}

const COLORS = ["blue", "amber", "rose", "violet"] as const;
const colorOf = (tone: string, old?: Habit["color"]): Habit["color"] =>
  COLORS.find((c) => c === tone) ?? old ?? "blue";
const PERIODS = ["Anytime", "Morning", "Afternoon", "Evening"] as const;
const periodOf = (tod: string): Habit["period"] =>
  PERIODS.find((p) => p === tod) ?? "Anytime";

const ruleFor = (
  input: HabitInput,
  from: string,
  enabled = true,
): HabitRule => ({
  from,
  days: input.days.map((d) => (d + 6) % 7).sort((a, b) => a - b),
  kind: input.kind,
  target: input.target,
  unit: input.unit,
  enabled,
});

const sameRule = (a: HabitRule | undefined, b: HabitRule) =>
  !!a &&
  a.kind === b.kind &&
  a.target === b.target &&
  a.unit === b.unit &&
  a.enabled === b.enabled &&
  a.days.length === b.days.length &&
  [...a.days].sort().every((d, i) => d === [...b.days].sort()[i]);

export function saveHabit(hb: HabitRow | null, input: HabitInput): Change {
  const row = {
    name: input.name,
    icon: input.icon,
    tone: input.tone,
    unit: input.kind === "count" ? input.unit : null,
    kind: input.kind,
    target: input.target,
    step: input.step,
    days: input.days,
    tod: input.tod,
    cat: input.cat,
    why: input.why,
  };
  return {
    sample: (view) => {
      const h = hb && viewHabit(view, hb.id);
      if (h) Object.assign(h, row);
      else
        view.habits.push({
          id: nid("h"),
          status: "active",
          created: input.created,
          ...row,
        });
    },
    real: store((data) => {
      const own = {
        name: input.name,
        description: input.why,
        category: input.cat,
        period: periodOf(input.tod),
      };
      if (!hb)
        return {
          ...data,
          habits: [
            ...data.habits,
            {
              id: nid("h"),
              ...own,
              color: colorOf(input.tone),
              rules: [ruleFor(input, input.created)],
              pauses: [],
            },
          ],
        };
      const old = habitIn(data, hb.id);
      const last = old.rules.at(-1);
      const rule = ruleFor(input, TODAY, last?.enabled ?? true);
      const next = { ...old, ...own, color: colorOf(input.tone, old.color) };
      return replace(
        data,
        sameRule(last, rule) ? next : changeRule(next, rule),
      );
    }),
  };
}

/** Stops scheduling from today, or schedules again; history stays. */
export function setArchived(hb: HabitRow, archived: boolean): Change {
  return {
    keys: ["habits"],
    sample: (view) => {
      const h = viewHabit(view, hb.id);
      if (h) h.status = archived ? "archived" : "active";
    },
    real: store((data) => {
      const old = habitIn(data, hb.id);
      const last = old.rules.at(-1)!;
      return replace(
        data,
        changeRule(old, { ...last, from: TODAY, enabled: !archived }),
      );
    }),
  };
}

/** Pauses from today until `until`, or until resumed when it's null. */
export function pauseHabit(hb: HabitRow, until: string | null): Change {
  return {
    sample: (view) => {
      const h = viewHabit(view, hb.id);
      if (!h) return;
      h.status = "paused";
      h.pauses = [...(h.pauses || []), { from: TODAY, until }];
    },
    real: store((data) => {
      const old = habitIn(data, hb.id);
      return replace(data, {
        ...old,
        pauses: [
          ...old.pauses,
          { from: TODAY, to: until ?? PAUSE_UNTIL_RESUMED },
        ],
      });
    }),
  };
}

export function resume(hb: HabitRow): Change {
  return {
    sample: (view) => {
      const h = viewHabit(view, hb.id);
      if (!h) return;
      h.status = "active";
      h.pauses = (h.pauses || [])
        .map((p) =>
          !p.until || p.until >= TODAY
            ? { ...p, until: addDays(TODAY, -1) }
            : p,
        )
        .filter((p) => !p.until || p.until >= p.from);
    },
    real: store((data) =>
      replace(data, resumeHabit(habitIn(data, hb.id), TODAY)),
    ),
  };
}

/** Removes a habit and every check-in it has. */
export function deleteHabit(hb: HabitRow): Change {
  return {
    keys: ["habits", ...LOG_KEYS],
    sample: (view) => {
      view.habits = view.habits.filter((y) => y.id !== hb.id);
      for (const m of LOG_KEYS)
        for (const k of Object.keys(view[m]))
          if (k.startsWith(hb.id + ":")) delete view[m][k];
    },
    real: store((data) => ({
      ...data,
      habits: data.habits.filter((h) => h.id !== hb.id),
      entries: data.entries.filter((e) => e.habitId !== hb.id),
    })),
  };
}
