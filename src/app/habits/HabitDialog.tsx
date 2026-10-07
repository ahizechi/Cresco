// Creates or edits a habit; editing also offers archive or delete.
import { useState } from "react";
import { sampleMode } from "@sample";
import { TODAY, dlong } from "../core/dates";
import { apply } from "../core/commands";
import { S, closeDialog } from "../core/state";
import type { HabitRow } from "../core/view";
import { DateField } from "../ui/DateTimeFields";
import { Btn, Field, I, Input, Seg, Sel } from "../ui/controls";
import { DayChips, ToneRow } from "../ui/form";
import { Dialog } from "../ui/layout";
import { useSubmit } from "../ui/useSubmit";
import { deleteHabit, saveHabit, setArchived } from "./commands";
import {
  HABIT_ICONS,
  SAVED_TONES,
  checkHabit,
  habitForm,
  habitInput,
  savedText,
  type HabitErrors,
  type HabitForm,
} from "./form";
import { TODS } from "./selectors";

function DeleteHabit({ hb, onKeep }: { hb: HabitRow; onKeep: () => void }) {
  const n = Object.keys(S.hlog).filter((k) => k.startsWith(hb.id + ":")).length;
  const run = async (archive: boolean) => {
    const ok = archive
      ? await apply(
          setArchived(hb, true),
          hb.name + " archived · history kept",
          {
            undo: true,
          },
        )
      : await apply(deleteHabit(hb), hb.name + " deleted", { undo: true });
    if (ok) closeDialog();
  };
  return (
    <div className="err" role="alert">
      <I n="triangle-alert" />
      <div style={{ flex: "1" }}>
        <div className="strong">{`Delete ${hb.name} and its ${n} check-ins?`}</div>
        <div className="meta" style={{ margin: "2px 0 10px" }}>
          This removes its whole history. Archive keeps the history and stops
          scheduling.
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Btn sm onClick={onKeep}>
            Keep it
          </Btn>
          <Btn sm i="archive" onClick={() => void run(true)}>
            Archive instead
          </Btn>
          <Btn sm v="danger" onClick={() => void run(false)}>
            Delete permanently
          </Btn>
        </div>
      </div>
    </div>
  );
}

export function HabitDialog({ hb }: { hb?: HabitRow }) {
  const [f, setF] = useState<HabitForm>(() => habitForm(hb));
  const [err, setErr] = useState<HabitErrors>({});
  const [del, setDel] = useState(false);
  const { busy, submit } = useSubmit();
  const up =
    <K extends keyof HabitForm>(k: K) =>
    (v: HabitForm[K]) =>
      setF({ ...f, [k]: v });
  const save = () => {
    const e = checkHabit(f, hb);
    setErr(e);
    if (Object.keys(e).length) return;
    void submit(saveHabit(hb ?? null, habitInput(f)), savedText(f, !!hb));
  };
  return (
    <Dialog
      title={hb ? "Edit habit" : "New habit"}
      desc={
        hb
          ? "Schedule, target and unit changes apply from today. Earlier days keep their rules."
          : "Measured habits track an amount; check-off habits are done or not."
      }
      wide
      foot={
        <>
          {hb && (
            <>
              <Btn v="muted-ghost" i="trash-2" onClick={() => setDel(true)}>
                Delete…
              </Btn>
              <span className="grow" />
            </>
          )}
          <Btn onClick={closeDialog}>Cancel</Btn>
          <Btn v="primary" disabled={busy} onClick={save}>
            {hb ? "Save habit" : "Create habit"}
          </Btn>
        </>
      }
    >
      {del && hb ? (
        <DeleteHabit hb={hb} onKeep={() => setDel(false)} />
      ) : (
        <div className="form">
          <Field label="Name" id="hb-name" error={err.name}>
            <Input
              id="hb-name"
              value={f.name}
              onInput={up("name")}
              placeholder="e.g. Drink water"
            />
          </Field>
          <div className="form-2">
            <Field
              label="Category"
              id="hb-cat"
              hint="Optional, used for search"
            >
              <Input
                id="hb-cat"
                value={f.cat}
                onInput={up("cat")}
                placeholder="e.g. Health"
              />
            </Field>
            <Field label="Why it matters" id="hb-why" hint="Optional">
              <Input
                id="hb-why"
                value={f.why}
                onInput={up("why")}
                placeholder="e.g. Better sleep"
              />
            </Field>
          </div>
          <div className="form-2">
            {sampleMode && (
              <Field label="Icon" id="hb-icon">
                <Sel
                  id="hb-icon"
                  value={f.icon}
                  onChange={up("icon")}
                  options={HABIT_ICONS}
                />
              </Field>
            )}
            <div className="field">
              <span className="field-label">Colour</span>
              <ToneRow
                value={f.tone}
                onChange={up("tone")}
                tones={sampleMode ? undefined : SAVED_TONES}
              />
            </div>
          </div>
          <div className="field">
            <span className="field-label">Measure</span>
            <Seg
              value={f.measure}
              onChange={up("measure")}
              options={[
                { v: "amount", l: "An amount" },
                { v: "check", l: "Check off" },
              ]}
              label="Measure"
            />
          </div>
          {f.measure === "amount" && (
            <div
              className="form-2"
              style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
            >
              <Field label="Daily target" id="hb-target" error={err.target}>
                <Input
                  id="hb-target"
                  inputMode="numeric"
                  value={f.target}
                  onInput={up("target")}
                />
              </Field>
              <Field label="Unit" id="hb-unit" error={err.unit}>
                <Input
                  id="hb-unit"
                  value={f.unit}
                  onInput={up("unit")}
                  placeholder="pages, min, reps"
                />
              </Field>
              <Field label="Quick add step" id="hb-step">
                <Input
                  id="hb-step"
                  inputMode="numeric"
                  value={f.step}
                  onInput={up("step")}
                />
              </Field>
            </div>
          )}
          <div className="field">
            <span className="field-label">Repeat on</span>
            <DayChips value={f.days} onChange={up("days")} />
            {err.days && (
              <div className="field-error">
                <I n="circle-alert" s={14} />
                {err.days}
              </div>
            )}
          </div>
          <div className="form-2">
            <div className="field">
              <span className="field-label">Time of day</span>
              <Seg
                value={f.tod}
                onChange={up("tod")}
                options={TODS}
                label="Time of day"
              />
              <div className="field-hint">
                Groups the habit on Today. It doesn't send a notification.
              </div>
            </div>
            {!hb ? (
              <Field
                label="Start date"
                id="hb-start"
                error={err.created}
                hint="Pick an earlier date to backfill history."
              >
                <DateField
                  id="hb-start"
                  min="2000-01-01"
                  max={TODAY}
                  value={f.created}
                  onChange={up("created")}
                />
              </Field>
            ) : (
              <div className="field">
                <span className="field-label">Started</span>
                <div className="muted" style={{ paddingTop: "6px" }}>
                  {dlong(hb.created)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
