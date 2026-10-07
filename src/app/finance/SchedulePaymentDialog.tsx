import { useState } from "react";
import { sampleMode } from "@sample";
import { occurrences } from "../../features/finance/model";
import { TODAY, dshort } from "../core/dates";
import { money } from "../core/format";
import { closeDialog, dashboard } from "../core/state";
import type { ScheduleRow } from "../core/view";
import { Btn, Field, Sel } from "../ui/controls";
import { DateField } from "../ui/DateTimeFields";
import { Dialog } from "../ui/layout";
import { useSubmit } from "../ui/useSubmit";
import { recordPayment } from "./commands";

export function SchedulePaymentDialog({ s }: { s: ScheduleRow }) {
  const [dueDate, setDueDate] = useState(s.next);
  const [paidOn, setPaidOn] = useState(TODAY);
  const [existing, setExisting] = useState("");
  const data = dashboard.finance.data;
  const due =
    sampleMode ||
    occurrences(data, dueDate, dueDate).some((due) => due.item.id === s.id);
  const signed = s.amt * (s.kind === "income" ? 1 : -1);
  const matches = data.transactions.filter(
    (row) =>
      row.accountId === s.acct &&
      row.amount === signed &&
      row.kind === (s.kind === "income" ? "income" : "expense") &&
      row.status === "posted" &&
      !row.scheduleKey &&
      !row.transferId,
  );
  const { busy, submit } = useSubmit();
  const disabled = busy || !due || (!existing && paidOn > TODAY);
  return (
    <Dialog
      title={
        s.kind === "income"
          ? `Record ${s.name} received`
          : `Record ${s.name} paid`
      }
      desc="Choose the scheduled occurrence. Link a payment already in the ledger to avoid adding it twice."
      foot={
        <>
          <Btn onClick={closeDialog}>Cancel</Btn>
          <Btn
            v="primary"
            disabled={disabled}
            onClick={() =>
              void submit(
                recordPayment(s, dueDate, paidOn, existing || undefined),
                `${s.name} · ${dshort(dueDate)} occurrence recorded`,
                { undo: true },
              )
            }
          >
            {existing ? "Link saved payment" : "Record payment"}
          </Btn>
        </>
      }
    >
      <div className="form">
        <Field
          label="Scheduled date"
          id="payment-due"
          hint="Select the occurrence you are resolving, including an overdue one."
        >
          <DateField
            id="payment-due"
            value={dueDate}
            onChange={setDueDate}
            min={s.start || undefined}
            max={s.end || undefined}
          />
        </Field>
        {!due && (
          <p role="alert" className="field-error">
            That date is already recorded, paused or outside this schedule.
          </p>
        )}
        {!sampleMode && (
          <Field label="Payment" id="payment-existing">
            <Sel
              id="payment-existing"
              value={existing}
              onChange={setExisting}
              options={[
                { v: "", l: "Add a new ledger payment" },
                ...matches.map((row) => ({
                  v: row.id,
                  l: `${dshort(row.date)} · ${row.description} · ${money(row.amount, { cur: data.accounts.find((account) => account.id === row.accountId)?.currency })}`,
                })),
              ]}
            />
          </Field>
        )}
        {!existing && (
          <Field
            label="Paid or received on"
            id="payment-on"
            hint="This is the date the money actually moved."
          >
            <DateField
              id="payment-on"
              value={paidOn}
              onChange={setPaidOn}
              max={TODAY}
            />
          </Field>
        )}
        <p className="meta">
          {existing
            ? "The saved transaction keeps its amount, date, category and notes."
            : "A new transaction is added on the payment date. The scheduled occurrence is marked recorded."}
        </p>
      </div>
    </Dialog>
  );
}
