export const habitTabs = [
  ["today", "Today"],
  ["ongoing", "Ongoing"],
  ["library", "All habits"],
  ["history", "History"],
  ["insights", "Insights"],
  ["settings", "Settings"],
] as const;
export type HabitTab = (typeof habitTabs)[number][0];
export const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const timezones = [
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Helsinki",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Australia/Perth",
  "Pacific/Auckland",
  "UTC",
];
export interface HabitRule {
  from: string;
  days: number[];
  kind: "check" | "count";
  target: number;
  unit: string;
  enabled: boolean;
}
export interface Habit {
  id: string;
  name: string;
  description: string;
  category: string;
  period: "Anytime" | "Morning" | "Afternoon" | "Evening";
  color: "violet" | "blue" | "amber" | "rose";
  rules: HabitRule[];
  pauses: { from: string; to: string }[];
}
export interface CheckIn {
  habitId: string;
  date: string;
  value: number;
  skipped: boolean;
  note: string;
}
export interface HabitData {
  schema: 1;
  revision: number;
  timezone: string;
  habits: Habit[];
  entries: CheckIn[];
}
export type DayState =
  | "done"
  | "partial"
  | "skipped"
  | "missed"
  | "pending"
  | "paused"
  | "rest"
  | "inactive";
export const emptyHabits = (): HabitData => ({
  schema: 1,
  revision: 0,
  timezone: "Europe/London",
  habits: [],
  entries: [],
});
export const dateValid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^20\d{2}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
export function todayIn(timezone: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function addDays(date: string, count: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
}
export const dayNumber = (date: string) =>
  (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
export function dateLabel(date: string, short = false) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: short ? "short" : "long",
    day: "numeric",
    month: short ? "short" : "long",
  }).format(new Date(`${date}T12:00:00Z`));
}
export function datesBetween(from: string, to: string) {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}
export const entryKey = (habitId: string, date: string) => `${habitId}:${date}`;
export const entryIndex = (data: HabitData) =>
  new Map(data.entries.map((e) => [entryKey(e.habitId, e.date), e]));
export function ruleOn(habit: Habit, date: string) {
  for (let i = habit.rules.length - 1; i >= 0; i--)
    if (habit.rules[i].from <= date) return habit.rules[i];
  return undefined;
}
export function stateOn(
  habit: Habit,
  date: string,
  today: string,
  entries: Map<string, CheckIn>,
): DayState {
  const rule = ruleOn(habit, date);
  if (!rule) return "inactive";
  const entry = entries.get(entryKey(habit.id, date));
  if (entry?.skipped) return "skipped";
  if (entry && entry.value >= rule.target) return "done";
  if (entry && entry.value > 0) return "partial";
  if (!rule.enabled) return "inactive";
  if (habit.pauses.some((p) => p.from <= date && p.to >= date)) return "paused";
  if (!rule.days.includes(dayNumber(date))) return "rest";
  return date < today ? "missed" : "pending";
}
export const isScheduled = (state: DayState) =>
  ["done", "partial", "skipped", "missed", "pending"].includes(state);
export function statsFor(
  habit: Habit,
  today: string,
  entries: Map<string, CheckIn>,
) {
  let current = 0,
    best = 0,
    completed = 0,
    due28 = 0,
    done28 = 0;
  const cutoff = addDays(today, -28);
  for (const date of datesBetween(habit.rules[0].from, today)) {
    const state = stateOn(habit, date, today, entries);
    if (state === "done") {
      current++;
      completed++;
      best = Math.max(best, current);
    } else if (isScheduled(state) && (date < today || state === "skipped"))
      current = 0;
    // The current day is still open: only include closed days in consistency.
    if (date >= cutoff && date < today && isScheduled(state)) {
      due28++;
      if (state === "done") done28++;
    }
  }
  return { current, best, completed, due28, done28 };
}
export function changeRule(habit: Habit, rule: HabitRule): Habit {
  return {
    ...habit,
    rules: [...habit.rules.filter((r) => r.from < rule.from), rule],
  };
}
export function putEntry(data: HabitData, entry: CheckIn): HabitData {
  const habit = data.habits.find((h) => h.id === entry.habitId);
  const today = todayIn(data.timezone);
  if (
    !habit ||
    !dateValid(entry.date) ||
    entry.date > today ||
    entry.date < habit.rules[0].from
  )
    throw new Error("Choose a date between the habit’s start and today.");
  if (
    !Number.isSafeInteger(entry.value) ||
    entry.value < 0 ||
    entry.value > 1000000
  )
    throw new Error("Enter a whole number between 0 and 1,000,000.");
  const entries = data.entries.filter(
    (e) => e.habitId !== entry.habitId || e.date !== entry.date,
  );
  if (entry.value || entry.skipped || entry.note.trim())
    entries.push({
      ...entry,
      value: entry.skipped ? 0 : entry.value,
      note: entry.note.trim(),
    });
  return { ...data, entries };
}
export const scheduleLabel = (rule: HabitRule) =>
  rule.days.length === 7
    ? "Every day"
    : rule.days.map((d) => weekdays[d]).join(", ");

// Backups and preview storage are untrusted inputs; keep their contract aligned with Rust.
export function validateHabits(input: unknown): HabitData {
  const fail = (): never => {
    throw new Error(
      "This is not a supported Habits backup. The existing data has not changed.",
    );
  };
  const obj = (v: unknown): Record<string, unknown> =>
    v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : fail();
  const string = (v: unknown, max: number, required = false) =>
    typeof v === "string" &&
    v.length <= max &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v) &&
    (!required || v.trim().length > 0);
  const number = (v: unknown, max: number) =>
    typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= max;
  const v = obj(input);
  if (
    v.schema !== 1 ||
    !number(v.revision, 9007199254740990) ||
    !string(v.timezone, 100, true) ||
    !Array.isArray(v.habits) ||
    v.habits.length > 500 ||
    !Array.isArray(v.entries) ||
    v.entries.length > 200000
  )
    fail();
  if (!timezones.includes(v.timezone as string)) fail();
  const ids = new Map<string, Habit>();
  for (const item of v.habits as unknown[]) {
    const h = obj(item);
    if (
      !string(h.id, 80, true) ||
      !/^[\w-]+$/.test(h.id as string) ||
      ids.has(h.id as string) ||
      !string(h.name, 100, true) ||
      !string(h.description, 1000) ||
      !string(h.category, 40) ||
      !["Anytime", "Morning", "Afternoon", "Evening"].includes(
        h.period as string,
      ) ||
      !["violet", "blue", "amber", "rose"].includes(h.color as string) ||
      !Array.isArray(h.rules) ||
      !h.rules.length ||
      h.rules.length > 36600 ||
      !Array.isArray(h.pauses) ||
      h.pauses.length > 36600
    )
      fail();
    let last = "";
    for (const item of h.rules as unknown[]) {
      const r = obj(item);
      if (
        !dateValid(r.from) ||
        (r.from as string) <= last ||
        !Array.isArray(r.days) ||
        !r.days.length ||
        r.days.some((d) => !number(d, 6)) ||
        new Set(r.days).size !== r.days.length ||
        !["check", "count"].includes(r.kind as string) ||
        !number(r.target, 1000000) ||
        !r.target ||
        !string(r.unit, 30) ||
        typeof r.enabled !== "boolean" ||
        (r.kind === "check" && r.target !== 1)
      )
        fail();
      last = r.from as string;
    }
    for (const item of h.pauses as unknown[]) {
      const p = obj(item);
      if (
        !dateValid(p.from) ||
        !dateValid(p.to) ||
        (p.from as string) > (p.to as string)
      )
        fail();
    }
    ids.set(h.id as string, item as Habit);
  }
  const keys = new Set<string>();
  for (const item of v.entries as unknown[]) {
    const e = obj(item),
      habit = ids.get(e.habitId as string);
    if (
      !habit ||
      !dateValid(e.date) ||
      (e.date as string) < habit.rules[0].from ||
      !number(e.value, 1000000) ||
      typeof e.skipped !== "boolean" ||
      !string(e.note, 1000) ||
      (e.skipped && e.value !== 0)
    )
      fail();
    const key = entryKey(e.habitId as string, e.date as string);
    if (keys.has(key)) fail();
    keys.add(key);
  }
  return input as HabitData;
}
