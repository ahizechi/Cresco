// Habit progress read from the view: schedules, values, streaks.
import { TODAY, addDays, dmed, dow, mondayOf } from "../core/dates";
import { num } from "../core/format";
import { S } from "../core/state";
import type { HabitRow } from "../core/view";

export const TODS = ["Morning", "Afternoon", "Evening", "Anytime"] as const;

export const TZS = [
  "Europe/London",
  "Europe/Dublin",
  "Europe/Lisbon",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Athens",
  "Europe/Istanbul",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
];

export const hkey = (id: string, day: string) => id + ":" + day;
export const hval = (id: string, day: string) => S.hlog[hkey(id, day)] || 0;
/** The skip reason, "" for a skip without one, or undefined when not skipped. */
export const hskip = (hb: HabitRow, day: string): string | undefined =>
  S.hskip[hkey(hb.id, day)];
export const hrec = (hb: HabitRow, day: string) =>
  hkey(hb.id, day) in S.hlog || hkey(hb.id, day) in S.hskip;

export const inPause = (hb: HabitRow, day: string) =>
  (hb.pauses || []).some((p) => day >= p.from && (!p.until || day <= p.until));

/** Scheduled on a day: started, on a repeat day, and not paused unless logged. */
export const hsched = (hb: HabitRow, day: string) =>
  day >= hb.created &&
  hb.days.includes(dow(day)) &&
  (!inPause(hb, day) || hrec(hb, day));

export const hdone = (hb: HabitRow, day: string) =>
  hval(hb.id, day) >= hb.target;

export const measured = (hb: HabitRow) =>
  hb.kind === "count" || (hb.kind == null && !!hb.unit);

export const liveHabits = () => S.habits.filter((x) => x.status !== "archived");
export const activeHabits = () => S.habits.filter((x) => x.status === "active");

export const totalDone = (hb: HabitRow) =>
  Object.keys(S.hlog).filter(
    (k) => k.startsWith(hb.id + ":") && S.hlog[k] >= hb.target,
  ).length;

const weekDays = (mon: string) =>
  Array.from({ length: 7 }, (_, i) => addDays(mon, i)).filter(
    (d) => d <= TODAY,
  );
export const weekDone = (hb: HabitRow, mon: string) =>
  weekDays(mon).filter((d) => hdone(hb, d)).length;
export const weekDue = (hb: HabitRow, mon: string) =>
  weekDays(mon).filter((d) => hsched(hb, d)).length;

export const unitText = (hb: HabitRow, v: number) =>
  measured(hb)
    ? `${num(v)} of ${num(hb.target)}${hb.unit ? ` ${hb.unit}` : ""}`
    : v >= hb.target
      ? "Done"
      : "Not yet";

/** Consecutive completed scheduled days, counting today once it's done. */
export function streak(hb: HabitRow) {
  let n = 0;
  for (
    let d = hdone(hb, TODAY) ? TODAY : addDays(TODAY, -1);
    d >= hb.created;
    d = addDays(d, -1)
  )
    if (hsched(hb, d)) {
      if (!hdone(hb, d)) break;
      n++;
    }
  return n;
}

export function bestStreak(hb: HabitRow) {
  let best = 0,
    cur = 0;
  for (let d = hb.created; d <= TODAY; d = addDays(d, 1)) {
    if (!hsched(hb, d)) continue;
    if (hdone(hb, d)) best = Math.max(best, ++cur);
    else if (d !== TODAY) cur = 0;
  }
  return best;
}

/** Share of the scheduled closed days in the last `n` that were completed. */
export function consistency(hb: HabitRow, n = 28) {
  const days = Array.from({ length: n }, (_, i) =>
    addDays(TODAY, -1 - i),
  ).filter((d) => hsched(hb, d));
  return days.length
    ? days.filter((d) => hdone(hb, d)).length / days.length
    : null;
}

export type DayLevel = "off" | "skip" | "l3" | "l1" | "miss" | "";

/** A day's status text and its heat level. */
export function dayStatus(hb: HabitRow, day: string): [string, DayLevel] {
  if (!hsched(hb, day))
    return [inPause(hb, day) ? "Paused" : "Not scheduled", "off"];
  if (hskip(hb, day) != null) return ["Skipped", "skip"];
  const v = hval(hb.id, day);
  if (v >= hb.target) return [measured(hb) ? unitText(hb, v) : "Done", "l3"];
  if (v > 0) return [unitText(hb, v), "l1"];
  return day === TODAY
    ? ["Not yet", ""]
    : day > TODAY
      ? ["Upcoming", ""]
      : ["Missed", "miss"];
}

export function pauseText(hb: HabitRow) {
  const p = inPause(hb, TODAY)
    ? (hb.pauses || []).find(
        (x) => x.from <= TODAY && (!x.until || x.until >= TODAY),
      )
    : undefined;
  return p
    ? p.until
      ? `Paused through ${dmed(p.until)}`
      : `Paused since ${dmed(p.from)}`
    : "Paused";
}

/* ---------- history ---------- */

export interface HeatCell {
  d: string;
  blank?: boolean;
  lv?: "off" | "l3" | "l2" | "l1" | "";
  label?: string;
  /** Completed share of the day, 0-100; absent when nothing was scheduled. */
  pct?: number;
}

/**
 * Completion over the last `win` closed days for every live habit, or one
 * habit: totals, the best streak and heat-map cells laid out by week.
 */
export function history(win: number, hid: string) {
  const end = addDays(TODAY, -1),
    start = addDays(TODAY, -win);
  const pool =
    hid === "all" ? liveHabits() : S.habits.filter((x) => x.id === hid);
  const one = hid !== "all" ? (pool[0] ?? null) : null;
  let due = 0,
    done = 0,
    skipped = 0;
  const frac: Record<string, number | null> = {};
  for (let d = start; d <= end; d = addDays(d, 1)) {
    let a = 0,
      b = 0;
    for (const hb of pool)
      if (hsched(hb, d)) {
        a++;
        if (hdone(hb, d)) b++;
        else if (hskip(hb, d) != null) skipped++;
      }
    due += a;
    done += b;
    frac[d] = !a
      ? null
      : one
        ? hskip(one, d) != null
          ? 0
          : Math.min(1, hval(one.id, d) / one.target)
        : b / a;
  }
  const best = pool
    .map((x) => [x, bestStreak(x)] as const)
    .sort((a, b) => b[1] - a[1])[0];
  const cells: HeatCell[] = [];
  for (let w = mondayOf(start); w <= end; w = addDays(w, 7))
    for (let i = 0; i < 7; i++) {
      const d = addDays(w, i),
        f = frac[d];
      if (d < start || d > end) {
        cells.push({ d, blank: true });
        continue;
      }
      const text =
        f == null
          ? "nothing scheduled"
          : one
            ? dayStatus(one, d)[0]
            : Math.round(f * 100) + "% done";
      cells.push({
        d,
        lv:
          f == null
            ? "off"
            : f >= 1
              ? "l3"
              : f >= 0.5
                ? "l2"
                : f > 0
                  ? "l1"
                  : "",
        label: dmed(d) + ": " + text,
        pct: f == null ? undefined : Math.round(f * 100),
      });
    }
  return { start, end, pool, one, due, done, skipped, best, cells };
}

/* ---------- a day ---------- */

/** Live habits scheduled on a day. */
export const dayHabits = (day: string) =>
  liveHabits().filter((x) => hsched(x, day));

/** Share of a day's scheduled habits done, or null when none were due. */
export function dayFraction(day: string) {
  const due = dayHabits(day);
  return due.length
    ? due.filter((x) => hdone(x, day)).length / due.length
    : null;
}

/** A day's habits grouped by time of day, in day order. */
export const dayGroups = (day: string) =>
  TODS.map(
    (g) =>
      [g, dayHabits(day).filter((x) => (x.tod || "Anytime") === g)] as const,
  ).filter(([, list]) => list.length);

/** The day to select after moving to the week starting `mon`. */
export const dayInWeek = (mon: string, sel: string) => {
  const last = addDays(mon, 6);
  if (sel >= mon && sel <= last) return sel;
  return last >= TODAY ? TODAY : last;
};
