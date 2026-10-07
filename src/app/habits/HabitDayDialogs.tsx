// Logging or skipping one day of a habit, and pausing a habit.
import { useState } from "react";
import { TODAY, addDays, dlong, dmed } from "../core/dates";
import { apply } from "../core/commands";
import { num } from "../core/format";
import { S, closeDialog } from "../core/state";
import type { HabitRow } from "../core/view";
import { DateField } from "../ui/DateTimeFields";
import { Btn, Check, Field, I, Seg } from "../ui/controls";
import { Stepper } from "../ui/form";
import { Dialog } from "../ui/layout";
import { useSubmit } from "../ui/useSubmit";
import { clearDay, logDay, pauseHabit } from "./commands";
import { hkey, hrec, hskip, hval, measured } from "./selectors";

export function HabitDayDialog({
  hb,
  d,
  skip,
}: {
  hb: HabitRow;
  d: string;
  skip?: boolean;
}) {
  const k = hkey(hb.id, d);
  const [mode, setMode] = useState<"log" | "skip">(
    skip || hskip(hb, d) != null ? "skip" : "log",
  );
  const [v, setV] = useState(hval(hb.id, d));
  const [note, setNote] = useState(S.hnote[k] || S.hskip[k] || "");
  const { busy, submit } = useSubmit();
  const save = () =>
    void submit(
      logDay(hb, d, { skip: mode === "skip", value: v, note }),
      mode === "skip"
        ? `${hb.name} skipped · the streak restarts`
        : d === TODAY
          ? "Check-in saved"
          : "Correction saved · streaks recalculated",
    );
  const clear = async () => {
    if (await apply(clearDay(hb, d), "Check-in cleared", { undo: true }))
      closeDialog();
  };
  return (
    <Dialog
      title={hb.name}
      desc={
        dlong(d) +
        (d === TODAY
          ? " · today"
          : " · correcting a past day recalculates streaks")
      }
      foot={
        <>
          {hrec(hb, d) && (
            <>
              <Btn v="muted-ghost" i="eraser" onClick={() => void clear()}>
                Clear check-in
              </Btn>
              <span className="grow" />
            </>
          )}
          <Btn onClick={closeDialog}>Cancel</Btn>
          <Btn v="primary" disabled={busy} onClick={save}>
            {mode === "skip" ? "Skip this day" : "Save"}
          </Btn>
        </>
      }
    >
      <div className="form">
        <Seg
          value={mode}
          onChange={setMode}
          options={[
            { v: "log", l: "Log progress" },
            { v: "skip", l: "Skip" },
          ]}
          label="Day status"
        />
        {mode === "skip" ? (
          <div className="banner warn">
            <I n="info" />
            <p>
              A skip counts as scheduled but not completed, so it ends the
              current streak. To take a break without that, pause the habit.
            </p>
          </div>
        ) : measured(hb) ? (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Stepper
              value={v}
              onChange={setV}
              max={Math.max(hb.target * 4, v)}
              label={hb.unit || "Amount"}
            />
            <span className="muted">{`${hb.unit || ""} of ${num(hb.target)}`}</span>
          </div>
        ) : (
          <Seg
            value={v >= 1 ? "1" : "0"}
            onChange={(on) => setV(Number(on))}
            options={[
              { v: "1", l: "Done" },
              { v: "0", l: "Not done" },
            ]}
            label="Status"
          />
        )}
        <Field
          label={mode === "skip" ? "Reason" : "Note"}
          id="hd-note"
          hint="Optional"
        >
          <textarea
            id="hd-note"
            className="textarea"
            style={{ minHeight: "72px" }}
            value={note}
            onInput={(e) => setNote(e.currentTarget.value)}
          />
        </Field>
      </div>
    </Dialog>
  );
}

export function HabitPauseDialog({ hb }: { hb: HabitRow }) {
  const [open, setOpen] = useState(true);
  const [until, setUntil] = useState(addDays(TODAY, 6));
  const [err, setErr] = useState("");
  const { busy, submit } = useSubmit();
  const save = () => {
    if (!open && (!until || until < TODAY))
      return setErr("Choose today or a later day.");
    void submit(
      pauseHabit(hb, open ? null : until),
      open
        ? `${hb.name} paused until you resume`
        : `${hb.name} paused through ${dmed(until)}`,
    );
  };
  return (
    <Dialog
      title={"Pause " + hb.name}
      desc="Paused days neither count nor break the streak. Progress you've already logged stays."
      foot={
        <>
          <Btn onClick={closeDialog}>Cancel</Btn>
          <Btn v="primary" disabled={busy} onClick={save}>
            Pause habit
          </Btn>
        </>
      }
    >
      <div className="form">
        <label style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Check on={open} onChange={setOpen} label="Pause until I resume" />
          <span>Pause until I resume</span>
        </label>
        {!open && (
          <Field label="Last paused day" id="hp-until" error={err}>
            <DateField
              id="hp-until"
              min={TODAY}
              value={until}
              onChange={setUntil}
            />
          </Field>
        )}
      </div>
    </Dialog>
  );
}
