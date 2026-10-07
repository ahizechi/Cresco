// Ongoing timers and day streaks: their rows, changes and earlier runs.
import { sampleMode, sampleRoutineHistory } from "@sample";
import {
  changeRoutine,
  durationLabel,
  elapsed,
  type Routine,
  type RoutinesState,
} from "../../features/sections/routines";
import { section, write, type Change } from "../core/commands";
import { TODAY, dshort, dur } from "../core/dates";
import { dayMonthText } from "../core/format";
import { S, dashboard, nid } from "../core/state";
import type { RoutineRow, ViewState } from "../core/view";

const store =
  (change: (state: RoutinesState) => RoutinesState): Change["real"] =>
  ({ routines }) =>
    write(section(routines), change);

const days = (ms: number) => `${Math.floor(ms / 86400000)} days`;
const valueOf = (r: Routine, now: number) =>
  r.kind === "continuous"
    ? durationLabel(elapsed(r, now))
    : days(elapsed(r, now));

export function hydrateRoutines(view: ViewState, state: RoutinesState) {
  const now = Date.now();
  view.routines = state.routines.map((r) => ({
    id: r.id,
    name: r.title,
    kind: r.kind === "continuous" ? "timer" : "days",
    status: r.status,
    value: valueOf(r, now),
    note:
      r.status === "running"
        ? `Started ${dayMonthText(r.startedAt || r.createdAt)}`
        : r.status === "paused"
          ? "Paused"
          : "Stopped",
  }));
}

const saved = (r: RoutineRow) =>
  sampleMode
    ? undefined
    : dashboard.routines.value.routines.find((item) => item.id === r.id);

/** The running total, read live from the store outside sample mode. */
export function routineValue(r: RoutineRow) {
  const live = saved(r);
  return live ? valueOf(live, Date.now()) : r.value;
}

export type RoutineAction = "pause" | "resume" | "stop" | "restart";

function sampleElapsed(r: RoutineRow) {
  return (
    r.elapsedMs ??
    [...r.value.matchAll(/(\d+(?:\.\d+)?)\s*(days?|d|h|m)/g)].reduce(
      (total, match) =>
        total +
        Number(match[1]) *
          (match[2].startsWith("d")
            ? 86_400_000
            : match[2] === "h"
              ? 3_600_000
              : 60_000),
      0,
    )
  );
}

export function changeRoutineStatus(
  r: RoutineRow,
  action: RoutineAction,
): Change {
  return {
    keys: ["routines"],
    sample: (view) => {
      const row = view.routines.find((item) => item.id === r.id);
      if (!row) return;
      row.runs ??= sampleRoutineHistory(row.kind === "timer");
      row.elapsedMs = sampleElapsed(row);
      if (
        (action === "stop" || action === "restart") &&
        row.status !== "stopped"
      )
        row.runs.push({
          ended: `Ended ${dshort(TODAY)}`,
          elapsedMs: row.elapsedMs,
        });
      row.status =
        action === "pause"
          ? "paused"
          : action === "stop"
            ? "stopped"
            : "running";
      if (action === "restart") {
        row.value = r.kind === "timer" ? "0 m" : "0 days";
        row.elapsedMs = 0;
      }
      row.note =
        row.status === "stopped"
          ? "Stopped"
          : row.status === "paused"
            ? "Paused"
            : "Started today";
    },
    real: store((state) => ({
      ...state,
      routines: state.routines.map((item) =>
        item.id === r.id ? changeRoutine(item, action, Date.now()) : item,
      ),
    })),
  };
}

export function editRoutine(
  id: string,
  name: string,
  kind: "timer" | "streak",
): Change {
  const title = name.trim();
  if (!title || title.length > 200)
    throw new Error("Use a name from 1 to 200 characters.");
  return {
    keys: ["routines"],
    sample: (view) => {
      const row = view.routines.find((routine) => routine.id === id);
      if (!row) throw new Error("This routine is no longer available.");
      row.runs ??= sampleRoutineHistory(row.kind === "timer");
      row.elapsedMs = sampleElapsed(row);
      row.value =
        kind === "timer" ? durationLabel(row.elapsedMs) : days(row.elapsedMs);
      Object.assign(row, { name: title, kind });
    },
    real: store((state) => {
      if (!state.routines.some((routine) => routine.id === id))
        throw new Error("This routine is no longer available.");
      return {
        ...state,
        routines: state.routines.map((routine) =>
          routine.id === id
            ? {
                ...routine,
                title,
                kind: kind === "timer" ? "continuous" : "daily",
              }
            : routine,
        ),
      };
    }),
  };
}

export function deleteRoutine(id: string): Change {
  return {
    keys: ["routines"],
    sample: (view) => {
      view.routines = view.routines.filter((routine) => routine.id !== id);
    },
    real: store((state) => ({
      ...state,
      routines: state.routines.filter((routine) => routine.id !== id),
    })),
  };
}

export function startRoutine(name: string, kind: "timer" | "streak"): Change {
  return {
    sample: (view) => {
      view.routines.push({
        id: nid("r"),
        name,
        kind,
        status: "running",
        value: kind === "timer" ? "0 m" : "0 days",
        note: "Started today",
        elapsedMs: 0,
        runs: [],
      });
    },
    real: store((state) => {
      const at = new Date().toISOString();
      return {
        ...state,
        routines: [
          ...state.routines,
          {
            id: nid("r"),
            title: name,
            kind: kind === "timer" ? "continuous" : "daily",
            createdAt: at,
            status: "running",
            startedAt: at,
            elapsedMs: 0,
            checks: [],
            history: [],
          },
        ],
      };
    }),
  };
}

export interface RoutineRun {
  ended: string;
  len: string;
}

/** Earlier runs, newest first. */
export function routineRuns(r: RoutineRow): RoutineRun[] {
  const timer = r.kind === "timer";
  if (sampleMode)
    return [
      ...(S.routines.find((row) => row.id === r.id)?.runs ??
        sampleRoutineHistory(timer)),
    ]
      .reverse()
      .map((run) => ({
        ended: run.ended,
        len: timer
          ? dur(Math.round(run.elapsedMs / 60000))
          : days(run.elapsedMs),
      }));
  const live = saved(r);
  const runs = [...(live?.history ?? [])];
  if (live?.status === "stopped")
    runs.push({
      endedAt: live.stoppedAt ?? live.createdAt,
      elapsedMs: live.elapsedMs,
      endUnknown: !live.stoppedAt,
    });
  return runs.reverse().map((run) => ({
    ended: run.endUnknown
      ? "Stop date not recorded"
      : `Ended ${dayMonthText(run.endedAt)}`,
    len: timer
      ? dur(Math.round(run.elapsedMs / 60000))
      : `${Math.round(run.elapsedMs / 86400000)} days`,
  }));
}
