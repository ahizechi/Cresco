// Ongoing timers and streaks: the row, the start dialog and earlier runs.
import { useState } from "react";
import { apply } from "../core/commands";
import {
  S,
  closeDialog,
  confirmDialog,
  openDialog,
  openSheet,
} from "../core/state";
import type { RoutineRow as Routine } from "../core/view";
import { Btn, Field, Input, Seg, Status } from "../ui/controls";
import { Dialog, Empty, RowMenu, Sheet } from "../ui/layout";
import { useSubmit } from "../ui/useSubmit";
import {
  changeRoutineStatus,
  editRoutine,
  deleteRoutine,
  routineRuns,
  routineValue,
  startRoutine,
  type RoutineAction,
} from "./ongoing";

const change = (r: Routine, action: RoutineAction, done: string) =>
  void apply(changeRoutineStatus(r, action), done, { undo: true });

export function RoutineRow({ r, compact }: { r: Routine; compact?: boolean }) {
  const value = routineValue(r);
  return (
    <div className="row">
      <div className="row-main">
        <div>{r.name}</div>
        <div className="row-sub">
          {compact && <span className="num">{value}</span>}
          {compact && " · "}
          {r.note}
        </div>
      </div>
      {!compact && (
        <>
          <Status s={r.status} />
          <span
            className="num strong"
            style={{ minWidth: "64px", textAlign: "right" }}
          >
            {value}
          </span>
        </>
      )}
      <div className="row-end">
        {r.status === "running" ? (
          <Btn
            v="muted-ghost"
            sm
            icon
            i="pause"
            aria-label={"Pause " + r.name}
            onClick={() => change(r, "pause", r.name + " paused")}
          />
        ) : r.status === "paused" ? (
          <Btn
            v="muted-ghost"
            sm
            icon
            i="play"
            aria-label={"Resume " + r.name}
            onClick={() => change(r, "resume", r.name + " resumed")}
          />
        ) : null}
        <RowMenu
          label={"More for " + r.name}
          items={[
            { l: "Edit", i: "pencil", f: () => openDialog("routine", { r }) },
            {
              l: "Restart from zero",
              i: "refresh-cw",
              f: () =>
                confirmDialog({
                  title: `Restart ${r.name}?`,
                  text: `The current run (${value}) moves to history and a new one starts now.`,
                  ok: "Restart",
                  f: () => change(r, "restart", r.name + " restarted"),
                }),
            },
            {
              l: "History",
              i: "history",
              f: () => openSheet("routineHistory", { r }),
            },
            { sep: true },
            ...(r.status === "stopped"
              ? []
              : [
                  {
                    l: "Stop",
                    i: "square" as const,
                    danger: true,
                    f: () =>
                      confirmDialog({
                        title: `Stop ${r.name}?`,
                        text: "It stops counting and moves to history. You can start it again later.",
                        ok: "Stop",
                        danger: true,
                        f: () => change(r, "stop", r.name + " stopped"),
                      }),
                  },
                ]),
            {
              l: "Delete",
              i: "trash-2",
              danger: true,
              f: () =>
                confirmDialog({
                  title: `Delete ${r.name}?`,
                  text: "This removes the routine and every earlier run. You can undo this action.",
                  ok: "Delete routine",
                  danger: true,
                  f: () =>
                    void apply(deleteRoutine(r.id), r.name + " deleted", {
                      undo: true,
                    }),
                }),
            },
          ]}
        />
      </div>
    </div>
  );
}

export function RoutineDialog({ r }: { r?: Routine }) {
  const [name, setName] = useState(r?.name ?? "");
  const [kind, setKind] = useState<"streak" | "timer">(
    r?.kind === "timer" ? "timer" : "streak",
  );
  const [err, setErr] = useState("");
  const { busy, submit } = useSubmit();
  const start = () => {
    const title = name.trim();
    if (!title || title.length > 200)
      return setErr("Use a name from 1 to 200 characters.");
    void submit(
      r ? editRoutine(r.id, title, kind) : startRoutine(title, kind),
      title + (r ? " updated" : " started"),
      { undo: true },
    );
  };
  return (
    <Dialog
      title={r ? "Edit ongoing routine" : "Start something ongoing"}
      desc={
        r
          ? "Changing the name or display type keeps elapsed time and earlier runs."
          : "A timer counts time; a streak counts days since you started."
      }
      foot={
        <>
          <Btn onClick={closeDialog}>Cancel</Btn>
          <Btn v="primary" disabled={busy} onClick={start}>
            {r ? "Save changes" : "Start"}
          </Btn>
        </>
      }
    >
      <div className="form">
        <Field label="Name" id="rt-name" error={err}>
          <Input
            id="rt-name"
            value={name}
            maxLength={200}
            onInput={setName}
            placeholder="e.g. No sugar"
          />
        </Field>
        <div className="field">
          <span className="field-label">Type</span>
          <Seg
            value={kind}
            onChange={setKind}
            options={[
              { v: "streak", l: "Streak (days)" },
              { v: "timer", l: "Timer" },
            ]}
            label="Type"
          />
        </div>
      </div>
    </Dialog>
  );
}

export function RoutineArchiveSheet() {
  const rows = S.routines.filter((routine) => routine.status === "stopped");
  return (
    <Sheet
      title="Stopped routines"
      desc="Find earlier runs or restart a routine from zero."
    >
      <div className="rows">
        {rows.length ? (
          rows.map((r) => <RoutineRow key={r.id} r={r} />)
        ) : (
          <Empty
            icon="history"
            title="No stopped routines"
            text="A routine you stop appears here with its saved time and history."
          />
        )}
      </div>
    </Sheet>
  );
}

export function RoutineHistorySheet({ r }: { r: Routine }) {
  const runs = routineRuns(r);
  return (
    <Sheet
      title={`${r.name} history`}
      desc="Earlier runs, newest first."
      foot={
        r.status === "stopped" ? (
          <Btn onClick={() => openSheet("routineArchive")}>
            Back to stopped routines
          </Btn>
        ) : undefined
      }
    >
      <div className="rows">
        {!runs.length && (
          <Empty
            icon="history"
            title="No earlier runs"
            text="Past runs appear here when you stop or restart this routine."
          />
        )}
        {runs.map((x, i) => (
          <div className="row" key={i}>
            <div className="row-main">{x.ended}</div>
            <span className="num strong">{x.len}</span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
