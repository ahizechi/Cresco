// The habit editor's fields, their checks and the saved input.
import { sampleMode } from "@sample";
import { TODAY, dmed } from "../core/dates";
import type { HabitRow } from "../core/view";
import type { IconName } from "../ui/icons";
import type { HabitInput } from "./commands";
import { measured } from "./selectors";

export const HABIT_ICONS: { v: IconName; l: string }[] = [
  { v: "sparkles", l: "Sparkle" },
  { v: "droplet", l: "Water" },
  { v: "footprints", l: "Walk or run" },
  { v: "book-open", l: "Book" },
  { v: "brain", l: "Mind" },
  { v: "dumbbell", l: "Exercise" },
  { v: "moon", l: "Sleep" },
];

/** Saved habits keep one of these colours; sample habits take any tone. */
export const SAVED_TONES = ["blue", "amber", "rose"] as const;

export interface HabitForm {
  name: string;
  icon: IconName;
  tone: string;
  measure: "amount" | "check";
  target: string;
  unit: string;
  step: string;
  days: number[];
  tod: HabitRow["tod"];
  cat: string;
  why: string;
  created: string;
}

export const habitForm = (hb?: HabitRow): HabitForm =>
  hb
    ? {
        name: hb.name,
        icon: hb.icon,
        tone: hb.tone,
        measure: measured(hb) ? "amount" : "check",
        target: String(hb.target),
        unit: hb.unit || "",
        step: String(hb.step),
        days: [...hb.days],
        tod: hb.tod || "Anytime",
        cat: hb.cat || "",
        why: hb.why || "",
        created: hb.created,
      }
    : {
        name: "",
        icon: "sparkles",
        tone: "blue",
        measure: "amount",
        target: "1",
        unit: "",
        step: "1",
        days: [0, 1, 2, 3, 4, 5, 6],
        tod: "Anytime",
        cat: "",
        why: "",
        created: TODAY,
      };

export type HabitErrors = Partial<
  Record<"name" | "target" | "unit" | "days" | "created", string>
>;

export function checkHabit(f: HabitForm, hb?: HabitRow): HabitErrors {
  const e: HabitErrors = {};
  const t = Number(f.target);
  if (!f.name.trim()) e.name = "Name the habit.";
  if (
    f.measure === "amount" &&
    !(Number.isInteger(t) && t >= 1 && t <= 1000000)
  )
    e.target = "Use a whole number from 1 to 1,000,000.";
  // A saved count habit without a unit may keep it that way.
  if (
    f.measure === "amount" &&
    !f.unit.trim() &&
    !(hb?.kind === "count" && !hb.unit)
  )
    e.unit = "Add a unit, like pages or min.";
  if (!f.days.length) e.days = "Pick at least one day.";
  if (!hb && (!f.created || f.created > TODAY || f.created < "2000-01-01"))
    e.created = "Choose today or an earlier date.";
  return e;
}

export function habitInput(f: HabitForm): HabitInput {
  const amount = f.measure === "amount";
  return {
    name: f.name.trim(),
    icon: sampleMode ? f.icon : "sparkles",
    tone: f.tone,
    kind: amount ? "count" : "check",
    target: amount ? Number(f.target) : 1,
    unit: amount ? f.unit.trim() : "",
    step: amount ? Math.max(1, Math.round(Number(f.step)) || 1) : 1,
    days: f.days,
    tod: f.tod,
    cat: f.cat.trim(),
    why: f.why.trim(),
    created: f.created,
  };
}

export const savedText = (f: HabitForm, editing: boolean) =>
  editing
    ? "Habit updated · changes apply from today"
    : f.created < TODAY
      ? `${f.name.trim()} added from ${dmed(f.created)}`
      : `${f.name.trim()} added to today`;
