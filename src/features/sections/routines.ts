import { asRecord, asRows, asString } from "./revive";
import { validCalendarDate } from "./calendar";

export type Routine = {
  id: string;
  title: string;
  kind: "daily" | "continuous";
  createdAt: string;
  status: "running" | "paused" | "stopped";
  startedAt: string | null;
  elapsedMs: number;
  stoppedAt?: string;
  checks: string[];
  history: { endedAt: string; elapsedMs: number; endUnknown?: boolean }[];
};
export type RoutinesState = { routines: Routine[] };
export const initialRoutines: RoutinesState = { routines: [] };
export function reviveRoutines(value: unknown): RoutinesState {
  return {
    routines: asRows(
      asRecord(value).routines,
      (value) => {
        const row = asRecord(value);
        if (
          typeof row.id !== "string" ||
          typeof row.title !== "string" ||
          !row.title.trim() ||
          !["daily", "continuous"].includes(String(row.kind))
        )
          return null;
        const startedAt =
          typeof row.startedAt === "string" &&
          Number.isFinite(Date.parse(row.startedAt))
            ? row.startedAt
            : null;
        return {
          id: row.id,
          title: row.title,
          kind: row.kind as Routine["kind"],
          createdAt: asString(row.createdAt),
          status:
            row.status === "running" && startedAt
              ? "running"
              : row.status === "paused"
                ? "paused"
                : "stopped",
          startedAt,
          ...(typeof row.stoppedAt === "string" &&
          Number.isFinite(Date.parse(row.stoppedAt))
            ? { stoppedAt: row.stoppedAt }
            : {}),
          elapsedMs:
            typeof row.elapsedMs === "number" && Number.isFinite(row.elapsedMs)
              ? Math.max(0, row.elapsedMs)
              : 0,
          checks: Array.isArray(row.checks)
            ? [
                ...new Set(
                  row.checks.filter(
                    (date): date is string =>
                      typeof date === "string" && validCalendarDate(date),
                  ),
                ),
              ]
                .sort()
                .slice(-730)
            : [],
          history: asRows(
            row.history,
            (value) => {
              const item = asRecord(value);
              return typeof item.endedAt === "string" &&
                Number.isFinite(Date.parse(item.endedAt)) &&
                typeof item.elapsedMs === "number" &&
                Number.isFinite(item.elapsedMs) &&
                item.elapsedMs >= 0
                ? {
                    endedAt: item.endedAt,
                    elapsedMs: item.elapsedMs,
                    ...(item.endUnknown === true ? { endUnknown: true } : {}),
                  }
                : null;
            },
            100,
          ),
        };
      },
      200,
    ),
  };
}
export function elapsed(routine: Routine, now: number): number {
  return (
    routine.elapsedMs +
    (routine.status === "running" && routine.startedAt
      ? Math.max(0, now - Date.parse(routine.startedAt))
      : 0)
  );
}
export function changeRoutine(
  routine: Routine,
  action: "pause" | "resume" | "stop" | "restart",
  now: number,
): Routine {
  const total = elapsed(routine, now),
    at = new Date(now).toISOString();
  if (action === "restart")
    return {
      ...routine,
      status: "running",
      elapsedMs: 0,
      startedAt: at,
      stoppedAt: undefined,
      history: [
        ...routine.history,
        {
          endedAt:
            routine.status === "stopped" ? (routine.stoppedAt ?? at) : at,
          elapsedMs: total,
          ...(routine.status === "stopped" && !routine.stoppedAt
            ? { endUnknown: true }
            : {}),
        },
      ].slice(-100),
    };
  if (action === "resume")
    return routine.status === "paused"
      ? { ...routine, status: "running", startedAt: at }
      : routine;
  if (routine.status === "stopped") return routine;
  return {
    ...routine,
    status: action === "pause" ? "paused" : "stopped",
    elapsedMs: total,
    startedAt: null,
    ...(action === "stop" ? { stoppedAt: at } : {}),
  };
}
export function durationLabel(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60000),
    hours = Math.floor(minutes / 60),
    days = Math.floor(hours / 24);
  return days
    ? `${days}d ${hours % 24}h ${minutes % 60}m`
    : hours
      ? `${hours}h ${minutes % 60}m`
      : `${minutes}m`;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
export function validateRoutines(value: unknown): RoutinesState {
  if (
    !value ||
    typeof value !== "object" ||
    !Array.isArray((value as { routines: unknown }).routines)
  )
    throw Error("Invalid routines collection.");
  const rows = (value as { routines: unknown[] }).routines;
  if (rows.length > 200) throw Error("Too many routines.");
  const revived = reviveRoutines(value);
  if (JSON.stringify(canonical(revived)) !== JSON.stringify(canonical(value)))
    throw Error("Invalid routine fields. Nothing was restored.");
  return revived;
}
