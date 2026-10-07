import { useState } from "react";
import { sampleMode } from "@sample";
import { TODAY, addDays } from "../core/dates";
import { money, parseMoney } from "../core/format";
import { S, closeDialog } from "../core/state";
import type { BudgetRow, GoalRow } from "../core/view";
import { Btn, Field, Input, Sel, Switch } from "../ui/controls";
import { DateField } from "../ui/DateTimeFields";
import { MoneyInput, ToneRow } from "../ui/form";
import { Dialog } from "../ui/layout";
import { useSubmit } from "../ui/useSubmit";
import { addToGoal, setGoalProgress, saveBudget, saveGoal } from "./commands";
import { SPEND_CATS, acctName, spentByCat } from "./selectors";

export function BudgetDialog({ b }: { b?: BudgetRow }) {
  const used = S.budgets.map((x) => x.cat);
  const free = SPEND_CATS.filter((c) => !used.includes(c));
  const [cat, setCat] = useState(b?.cat || free[0] || SPEND_CATS[0]);
  const [lim, setLim] = useState(b ? (b.limit / 100).toFixed(2) : "");
  const [roll, setRoll] = useState(b?.roll || false);
  const [err, setErr] = useState("");
  const { busy, submit } = useSubmit();
  const save = () => {
    const p = parseMoney(lim);
    if (!p || p <= 0) return setErr("Enter a monthly limit above £0.");
    void submit(saveBudget(cat, p, roll), "Budget saved");
  };
  return (
    <Dialog
      title={b ? `${b.cat} budget` : "Add budget"}
      desc="A monthly limit for one category."
      foot={
        <>
          <Btn onClick={closeDialog}>Cancel</Btn>
          <Btn v="primary" disabled={busy} onClick={save}>
            Save budget
          </Btn>
        </>
      }
    >
      <div className="form">
        {!b && (
          <Field label="Category" id="bd-c">
            <Sel id="bd-c" value={cat} onChange={setCat} options={free} />
          </Field>
        )}
        <Field
          label="Monthly limit"
          id="bd-l"
          error={err}
          hint={`Spent so far this month: ${money(spentByCat()[cat] || 0)}`}
        >
          <MoneyInput id="bd-l" value={lim} onInput={setLim} invalid={!!err} />
        </Field>
        {/* Saved budgets have no roll-over yet; only the sample shows it. */}
        {sampleMode && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div className="field-label">Roll over what's left</div>
              <div className="field-hint">
                Unspent money is added to next month
              </div>
            </div>
            <Switch on={roll} label="Roll over" onChange={setRoll} />
          </div>
        )}
      </div>
    </Dialog>
  );
}

export function GoalDialog({ g }: { g?: GoalRow }) {
  const [f, setF] = useState(() => ({
    name: g?.name ?? "",
    t: g ? (g.target / 100).toFixed(2) : "",
    by: g?.by ?? (sampleMode ? "2027-06-30" : addDays(TODAY, 365)),
    acct:
      g?.acct ??
      S.accounts.find((account) => !account.archived && account.cur === "GBP")
        ?.id ??
      "",
    tone: g?.tone ?? "blue",
  }));
  const [err, setErr] = useState<{ name?: string; t?: string }>({});
  const { busy, submit } = useSubmit();
  const up =
    <K extends keyof typeof f>(k: K) =>
    (v: (typeof f)[K]) =>
      setF({ ...f, [k]: v });
  const save = () => {
    const e: typeof err = {},
      p = parseMoney(f.t);
    if (!f.name.trim()) e.name = "Name the goal.";
    if (!p || p <= 0) e.t = "Enter a target above £0.";
    setErr(e);
    if (!p || Object.keys(e).length) return;
    void submit(
      saveGoal(g?.id ?? null, {
        name: f.name.trim(),
        target: p,
        by: f.by,
        acct: f.acct,
        tone: f.tone,
      }),
      "Goal saved",
    );
  };
  return (
    <Dialog
      title={g ? "Edit goal" : "New goal"}
      foot={
        <>
          <Btn onClick={closeDialog}>Cancel</Btn>
          <Btn v="primary" disabled={busy} onClick={save}>
            Save goal
          </Btn>
        </>
      }
    >
      <div className="form">
        <Field label="Goal" id="gl-n" error={err.name}>
          <Input
            id="gl-n"
            value={f.name}
            onInput={up("name")}
            placeholder="e.g. House deposit"
          />
        </Field>
        <div className="form-2">
          <Field label="Target" id="gl-t" error={err.t}>
            <MoneyInput
              id="gl-t"
              value={f.t}
              onInput={up("t")}
              invalid={!!err.t}
            />
          </Field>
          <Field label="By" id="gl-b">
            <DateField id="gl-b" value={f.by} onChange={up("by")} />
          </Field>
        </div>
        <Field label="Kept in" id="gl-a">
          <Sel
            id="gl-a"
            value={f.acct}
            onChange={up("acct")}
            options={S.accounts
              .filter((a) => !a.archived && a.bal >= 0 && a.cur === "GBP")
              .map((a) => ({ v: a.id, l: acctName(a.id) }))}
          />
        </Field>
        {/* Saved goals have no colour yet; only the sample shows it. */}
        {sampleMode && (
          <div className="field">
            <span className="field-label">Colour</span>
            <ToneRow value={f.tone} onChange={up("tone")} />
          </div>
        )}
      </div>
    </Dialog>
  );
}

export function ContribDialog({
  g,
  correct = false,
}: {
  g: GoalRow;
  correct?: boolean;
}) {
  const [amt, setAmt] = useState(correct ? (g.saved / 100).toFixed(2) : "");
  const [err, setErr] = useState("");
  const { busy, submit } = useSubmit();
  const save = () => {
    const p = parseMoney(amt);
    if (
      p === null ||
      !Number.isSafeInteger(p) ||
      p < 0 ||
      (!correct && p === 0)
    )
      return setErr(
        correct
          ? "Enter progress of £0.00 or more."
          : "Enter an amount above £0.00.",
      );
    void submit(
      correct ? setGoalProgress(g.id, p) : addToGoal(g, p),
      correct ? `${g.name} progress updated` : `${money(p)} added to ${g.name}`,
      {
        undo: true,
      },
    );
  };
  return (
    <Dialog
      title={correct ? `Update ${g.name} progress` : `Add money to ${g.name}`}
      desc={`${money(g.saved)} of ${money(g.target)} so far.`}
      foot={
        <>
          <Btn onClick={closeDialog}>Cancel</Btn>
          <Btn v="primary" disabled={busy} onClick={save}>
            {correct ? "Save progress" : "Add money"}
          </Btn>
        </>
      }
    >
      <Field
        label={correct ? "Money set aside" : "Amount"}
        id="ct-a"
        error={err}
        hint="Records the amount against the goal. It doesn't move money between accounts."
      >
        <MoneyInput id="ct-a" value={amt} onInput={setAmt} invalid={!!err} />
      </Field>
    </Dialog>
  );
}
