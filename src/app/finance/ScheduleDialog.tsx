import { useState } from "react";
import { TODAY, addDays } from "../core/dates";
import { parseMoney } from "../core/format";
import { S, closeDialog } from "../core/state";
import type { ScheduleRow } from "../core/view";
import { Btn, Field, Input, Seg, Sel } from "../ui/controls";
import { DateField } from "../ui/DateTimeFields";
import { MoneyInput } from "../ui/form";
import { Dialog } from "../ui/layout";
import { useSubmit } from "../ui/useSubmit";
import { type ScheduleInput, saveSchedule } from "./commands";
import { SPEND_CATS, acctName } from "./selectors";

const FREQS = ["Weekly", "Monthly", "Yearly"] as const;
const freqOf = (value: string): ScheduleInput["freq"] =>
  FREQS.find((f) => f === value) ?? "Monthly";

export function ScheduleDialog({ s: sc }: { s?: ScheduleRow }) {
  const [f, setF] = useState(() => ({
    name: sc?.name ?? "",
    kind: sc?.kind ?? ("bill" as ScheduleRow["kind"]),
    amount: sc ? (sc.amt / 100).toFixed(2) : "",
    freq: freqOf(sc?.freq ?? "Monthly"),
    next: sc ? sc.start || sc.next : addDays(TODAY, 7),
    acct: sc?.acct ?? S.accounts.find((account) => !account.archived)?.id ?? "",
    cat: sc?.cat ?? "Bills",
  }));
  const [err, setErr] = useState<{ name?: string; amount?: string }>({});
  const { busy, submit } = useSubmit();
  const up =
    <K extends keyof typeof f>(k: K) =>
    (v: (typeof f)[K]) =>
      setF({ ...f, [k]: v });
  const save = () => {
    const e: typeof err = {},
      p = parseMoney(f.amount);
    if (!f.name.trim()) e.name = "Name it.";
    if (!p || p <= 0) e.amount = "Enter an amount above £0.00.";
    setErr(e);
    if (!p || Object.keys(e).length) return;
    void submit(
      saveSchedule(sc?.id ?? null, {
        name: f.name.trim(),
        kind: f.kind,
        amt: p,
        freq: f.freq,
        next: f.next,
        acct: f.acct,
        cat: f.kind === "income" ? "Income" : f.cat,
      }),
      "Saved",
    );
  };
  return (
    <Dialog
      title={sc ? "Edit " + sc.name : "Add bill or income"}
      wide
      foot={
        <>
          <Btn onClick={closeDialog}>Cancel</Btn>
          <Btn v="primary" disabled={busy} onClick={save}>
            Save
          </Btn>
        </>
      }
    >
      <div className="form">
        <Seg
          value={f.kind}
          onChange={up("kind")}
          options={[
            { v: "bill", l: "Bill" },
            { v: "income", l: "Income" },
          ]}
          label="Kind"
        />
        <div className="form-2">
          <Field label="Name" id="sc-n" error={err.name}>
            <Input
              id="sc-n"
              value={f.name}
              onInput={up("name")}
              placeholder="e.g. Council tax"
            />
          </Field>
          <Field label="Amount" id="sc-a" error={err.amount}>
            <MoneyInput
              id="sc-a"
              value={f.amount}
              onInput={up("amount")}
              invalid={!!err.amount}
            />
          </Field>
          <Field label="Repeats" id="sc-f">
            <Sel
              id="sc-f"
              value={f.freq}
              onChange={up("freq")}
              options={FREQS}
            />
          </Field>
          <Field label="Start date" id="sc-d">
            <DateField id="sc-d" value={f.next} onChange={up("next")} />
          </Field>
          <Field label="Account" id="sc-ac">
            <Sel
              id="sc-ac"
              value={f.acct}
              onChange={up("acct")}
              options={S.accounts
                .filter(
                  (a) =>
                    !a.archived &&
                    (a.type === "Current" || a.type === "Credit card"),
                )
                .map((a) => ({ v: a.id, l: acctName(a.id) }))}
            />
          </Field>
          {f.kind === "bill" && (
            <Field label="Category" id="sc-c">
              <Sel
                id="sc-c"
                value={f.cat}
                onChange={up("cat")}
                options={SPEND_CATS}
              />
            </Field>
          )}
        </div>
      </div>
    </Dialog>
  );
}
