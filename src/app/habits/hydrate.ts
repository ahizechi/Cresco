// Projects the saved habits and check-ins into the Habits rows.
import type { HabitData } from "../../features/habits/model";
import { PAUSE_UNTIL_RESUMED } from "../../features/habits/pause";
import { TODAY } from "../core/dates";
import type { ViewState } from "../core/view";

/** Saved violet has no palette tone; it shows as teal and is kept on save. */
export const viewTone = (color: string) =>
  color === "violet" ? "teal" : color;

export function hydrateHabits(view: ViewState, data: HabitData) {
  view.profile.tz = data.timezone || "Europe/London";
  view.habits = data.habits.map((x) => {
    const rule = x.rules.at(-1)!;
    const paused = x.pauses.some((p) => p.from <= TODAY && p.to >= TODAY);
    return {
      id: x.id,
      name: x.name,
      icon: "sparkles",
      tone: viewTone(x.color),
      unit: rule.unit || null,
      kind: rule.kind,
      target: rule.target,
      step: rule.kind === "check" ? 1 : Math.min(5, rule.target),
      // Saved weekdays start on Monday; the view's start on Sunday.
      days: rule.days.map((d) => (d + 1) % 7),
      tod: x.period,
      cat: x.category,
      why: x.description,
      status: !rule.enabled ? "archived" : paused ? "paused" : "active",
      created: x.rules[0].from,
      pauses: x.pauses.map((p) => ({
        from: p.from,
        until: p.to === PAUSE_UNTIL_RESUMED ? null : p.to,
      })),
    };
  });
  const key = (e: HabitData["entries"][number]) => `${e.habitId}:${e.date}`;
  view.hlog = Object.fromEntries(
    data.entries.filter((e) => e.value).map((e) => [key(e), e.value]),
  );
  view.hskip = Object.fromEntries(
    data.entries.filter((e) => e.skipped).map((e) => [key(e), e.note]),
  );
  view.hnote = Object.fromEntries(
    data.entries
      .filter((e) => e.note && !e.skipped)
      .map((e) => [key(e), e.note]),
  );
}
