import { useState } from "react";
import { TODAY } from "../core/dates";
import { money, parseMoney } from "../core/format";
import { S, closeDialog } from "../core/state";
import type { TxnRow } from "../core/view";
import { Btn, Field, Input, Seg, Sel } from "../ui/controls";
import { DateField } from "../ui/DateTimeFields";
import { MoneyInput } from "../ui/form";
import { Dialog } from "../ui/layout";
import { useSubmit } from "../ui/useSubmit";
import { removeTransactions } from "./actions";
import { saveTransaction } from "./commands";
import { CATS, acct, acctName } from "./selectors";

interface Form {
  date: string;
  merchant: string;
  cat: string;
  acct: string;
  dir: "out" | "in";
  amount: string;
  status: TxnRow["status"];
  note: string;
}

const initial = (t?: TxnRow): Form =>
  t
    ? {
        date: t.date,
        merchant: t.merchant,
        cat: t.cat,
        acct: t.acct,
        dir: t.amt < 0 ? "out" : "in",
        amount: (Math.abs(t.amt) / 100).toFixed(2),
        status: t.status,
        note: t.note,
      }
    : {
        date: TODAY,
        merchant: "",
        cat: "Groceries",
        acct: S.accounts.find((account) => !account.archived)?.id || "",
        dir: "out",
        amount: "",
        status: "cleared",
        note: "",
      };

export function TxnDialog({ t }: { t?: TxnRow }) {
  const [f, setF] = useState(() => initial(t));
  const [err, setErr] = useState<{ merchant?: string; amount?: string }>({});
  const { busy, submit } = useSubmit();
  const up =
    <K extends keyof Form>(k: K) =>
    (v: Form[K]) =>
      setF({ ...f, [k]: v });
  const save = async () => {
    const e: typeof err = {},
      p = parseMoney(f.amount);
    if (!f.merchant.trim()) e.merchant = "Add who it was paid to or from.";
    if (!p || p <= 0) e.amount = "Enter an amount above £0.00.";
    setErr(e);
    if (!p || Object.keys(e).length) return;
    const amt = f.dir === "out" ? -p : p;
    const merchant = f.merchant.trim();
    await submit(
      saveTransaction(t?.id ?? null, {
        date: f.date,
        merchant,
        cat: f.cat,
        acct: f.acct,
        amt,
        status: f.status,
        note: f.note,
      }),
      t ? "Transaction updated" : `Added ${merchant} ${money(amt)}`,
      { undo: true },
    );
  };
  const linked = t?.source === "CSV import";
  return (
    <Dialog
      title={t ? "Edit transaction" : "Add transaction"}
      desc={
        linked
          ? `From ${acct(t.acct)?.inst} via bank link. Your edits are kept when the bank sends it again.`
          : t
            ? "Entered by you or imported from a statement."
            : "For cash or anything the bank link doesn't cover."
      }
      wide
      foot={
        <>
          {t && (
            <>
              <Btn
                v="muted-ghost"
                i="trash-2"
                onClick={() => {
                  closeDialog();
                  removeTransactions([t.id]);
                }}
              >
                Delete
              </Btn>
              <span className="grow" />
            </>
          )}
          <Btn onClick={closeDialog}>Cancel</Btn>
          <Btn v="primary" disabled={busy} onClick={() => void save()}>
            {t ? "Save changes" : "Add transaction"}
          </Btn>
        </>
      }
    >
      <div className="form">
        <Seg
          value={f.dir}
          onChange={up("dir")}
          options={[
            { v: "out", l: "Money out" },
            { v: "in", l: "Money in" },
          ]}
          label="Direction"
        />
        <div className="form-2">
          <Field label="Paid to or from" id="tx-m" error={err.merchant}>
            <Input
              id="tx-m"
              value={f.merchant}
              onInput={up("merchant")}
              placeholder="e.g. Tesco"
            />
          </Field>
          <Field label="Amount" id="tx-a" error={err.amount}>
            <MoneyInput
              id="tx-a"
              value={f.amount}
              onInput={up("amount")}
              cur={acct(f.acct)?.cur || "GBP"}
              invalid={!!err.amount}
            />
          </Field>
          <Field label="Date" id="tx-d">
            <DateField id="tx-d" value={f.date} onChange={up("date")} />
          </Field>
          <Field label="Account" id="tx-ac">
            <Sel
              id="tx-ac"
              value={f.acct}
              onChange={up("acct")}
              options={S.accounts
                .filter(
                  (a) =>
                    !a.archived &&
                    a.type !== "Pension" &&
                    a.type !== "Investment",
                )
                .map((a) => ({ v: a.id, l: acctName(a.id) }))}
            />
          </Field>
          <Field label="Category" id="tx-c">
            <Sel
              id="tx-c"
              value={f.cat}
              onChange={up("cat")}
              options={Object.keys(CATS).filter((c) => c !== "Transfer")}
            />
          </Field>
          <Field label="Status" id="tx-s">
            <Sel
              id="tx-s"
              value={f.status}
              onChange={up("status")}
              options={[
                { v: "cleared", l: "Cleared" },
                { v: "pending", l: "Pending" },
              ]}
            />
          </Field>
        </div>
        <Field label="Note" id="tx-n">
          <Input
            id="tx-n"
            value={f.note}
            onInput={up("note")}
            placeholder="Optional"
          />
        </Field>
      </div>
    </Dialog>
  );
}
