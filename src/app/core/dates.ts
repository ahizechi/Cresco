// Calendar-day helpers. Days are local YYYY-MM-DD strings, read at noon so a
// daylight-saving change never moves them; minutes count from midnight.
import { pad } from "./format";
import { SAMPLE_DAY, sampleMode } from "@sample";

export const iso = (date: Date) =>
  date.getFullYear() +
  "-" +
  pad(date.getMonth() + 1) +
  "-" +
  pad(date.getDate());

let clockZone = "Europe/London";
export const currentDay = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: clockZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function setClockZone(zone: string) {
  clockZone = zone;
  tickClock();
}
const currentMinute = () =>
  new Date().getHours() * 60 + new Date().getMinutes();

/** Today and the current minute. Sample mode keeps the seed's fixed clock. */
export let TODAY = sampleMode ? SAMPLE_DAY : currentDay();
export let NOW_MIN = sampleMode ? 14 * 60 + 5 : currentMinute();

/** Advances the live clock; returns whether it changed. */
export function tickClock(): boolean {
  const day = currentDay();
  const minute = currentMinute();
  if (day === TODAY && minute === NOW_MIN) return false;
  TODAY = day;
  NOW_MIN = minute;
  return true;
}

export const MON = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
export const MONTH = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
/** Weekday names indexed by Date.getDay(): Sunday is 0. */
export const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
/** Weekday names in display order, Monday first. */
export const DOW_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const toD = (day: string) => new Date(day + "T12:00:00");
export const addDays = (day: string, days: number) => {
  const date = toD(day);
  date.setDate(date.getDate() + days);
  return iso(date);
};

/** 24 Sep */
export const dshort = (day: string) => {
  const date = toD(day);
  return date.getDate() + " " + MON[date.getMonth()];
};
/** Wed 24 Sep */
export const dmed = (day: string) => {
  const date = toD(day);
  return DOW[date.getDay()] + " " + date.getDate() + " " + MON[date.getMonth()];
};
/** Wednesday 24 September */
export const dlong = (day: string) => {
  const date = toD(day);
  return (
    DAY[date.getDay()] + " " + date.getDate() + " " + MONTH[date.getMonth()]
  );
};

export const dow = (day: string) => toD(day).getDay();
export const mondayOf = (day: string) => addDays(day, -((dow(day) + 6) % 7));

/** Minutes after midnight as HH:MM. */
export const hm = (minutes: number) =>
  pad(Math.floor(minutes / 60)) + ":" + pad(minutes % 60);
/** HH:MM as minutes after midnight. */
export const toMin = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};
/** 90 → "1 h 30 min" */
export const dur = (minutes: number) =>
  minutes >= 60
    ? Math.floor(minutes / 60) +
      " h" +
      (minutes % 60 ? " " + (minutes % 60) + " min" : "")
    : minutes + " min";

export const dayN = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

/** Weekday numbers (Sunday 0) as "Every day", "Weekdays" or "Mon, Wed". */
export const daysText = (days: number[]) =>
  days.length === 7
    ? "Every day"
    : days.length === 5 && !days.includes(0) && !days.includes(6)
      ? "Weekdays"
      : [1, 2, 3, 4, 5, 6, 0]
          .filter((day) => days.includes(day))
          .map((day) => DOW[day])
          .join(", ");

/** The day a quick-added task names: tomorrow, none for "someday", else today. */
export const guessDate = (text: string) =>
  /tomorrow/i.test(text)
    ? addDays(TODAY, 1)
    : /(someday|anytime|eventually)/i.test(text)
      ? null
      : TODAY;

/** Relative day label: Today, Tomorrow, Yesterday or Wed 24 Sep. */
export const whenText = (day: string | null | undefined) =>
  !day
    ? "Any time"
    : day === TODAY
      ? "Today"
      : day === addDays(TODAY, 1)
        ? "Tomorrow"
        : day === addDays(TODAY, -1)
          ? "Yesterday"
          : dmed(day);
