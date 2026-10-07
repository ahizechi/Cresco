import { useState } from "react";
import { sampleMode } from "@sample";
import { TODAY, dshort } from "../core/dates";
import { cx, money, parseMoney } from "../core/format";
import { S, dashboard, closeDialog } from "../core/state";
import { balance as ledgerBalance } from "../../features/finance/model";
import type { AccountRow } from "../core/view";
import { Btn, Field, Input, Seg, Sel, Switch } from "../ui/controls";
import { DateField } from "../ui/DateTimeFields";
import { MoneyInput } from "../ui/form";
import { Dialog } from "../ui/layout";
import { useSubmit } from "../ui/useSubmit";
import { markTransfer, reconcile, saveAccount } from "./commands";
import { acctName } from "./selectors";

export function TransferDialog({
  ids,
  done,
}: {
  ids: string[];
  done?: () => void;
}) {
  const txs = S.txns.filter((t) => ids.includes(t.id));
  const from = txs[0]?.acct;
  const accounts = S.accounts.filter((a) => !a.archived);
  const [to, setTo] = useState(accounts.find((a) => a.id !== from)?.id ?? "");
  const { busy, submit } = useSubmit();
  const save = async () => {
    if (
      await submit(markTransfer(ids, to), `${txs.length} marked as transfer`, {
        undo: true,
      })
    )
      done?.();
  };
  return (
    <Dialog
      title="Mark as transfer"
      desc="Transfers between your own accounts don't count as spending or income."
      foot={
        <>
          <Btn onClick={closeDialog}>Cancel</Btn>
          <Btn v="primary" disabled={busy || !to} onClick={() => void save()}>
            Mark as transfer
          </Btn>
        </>
      }
    >
      <div className="rows">
        {txs.slice(0, 4).map((t) => (
          <div className="row" key={t.id}>
            <div className="row-main">
              {t.merchant}
              <div className="row-sub">
                {`${dshort(t.date)} · ${acctName(t.acct)}`}
              </div>
            </div>
            <span className="num">{money(t.amt)}</span>
          </div>
        ))}
        {txs.length > 4 && (
          <div className="row meta">{`and ${txs.length - 4} more`}</div>
        )}
      </div>
      <Field label="Other account" id="tr-to">
        <Sel
          id="tr-to"
          value={to}
          onChange={setTo}
          options={accounts.map((a) => ({ v: a.id, l: acctName(a.id) }))}
        />
      </Field>
    </Dialog>
  );
}

const ACCOUNT_TYPES = sampleMode
  ? ["Current", "Savings", "Credit card", "Investment", "Pension"]
  : ["Current", "Savings", "Credit card", "Cash"];

export function AccountDialog({
  a,
  balance,
}: {
  a?: AccountRow;
  balance?: boolean;
}) {
  const stored =
    a && dashboard.finance.data.accounts.find((account) => account.id === a.id);
  const [balanceType, setBalanceType] = useState<"current" | "opening">(
    "current",
  );
  const [openingDate, setOpeningDate] = useState(stored?.openingDate ?? TODAY);
  const [f, setF] = useState(() => ({
    name: a?.name ?? "",
    type: a?.type ?? "Current",
    cur: a?.cur ?? "GBP",
    inNet: a?.inNet ?? true,
    amount: a ? (a.bal / 100).toFixed(2) : "0.00",
  }));
  const [err, setErr] = useState("");
  const { busy, submit } = useSubmit();
  const up =
    <K extends keyof typeof f>(k: K) =>
    (v: (typeof f)[K]) =>
      setF({ ...f, [k]: v });
  const linked = !!a && a.source !== "Manual";
  const save = () => {
    if (!f.name.trim()) return setErr("Name the account.");
    const parsed = parseMoney(f.amount);
    if (!linked && parsed === null) return setErr("Enter a valid balance.");
    void submit(
      saveAccount(a ?? null, {
        name: f.name.trim(),
        type: f.type,
        cur: f.cur,
        inNet: f.inNet,
        bal:
          linked || balanceType === "opening" || (a && parsed === a.bal)
            ? null
            : parsed,
        baseline:
          !linked && balanceType === "opening" && parsed !== null
            ? { date: openingDate, balance: parsed }
            : undefined,
      }),
      a ? "Account updated" : "Account added",
    );
  };
  return (
    <Dialog
      title={
        a ? (balance ? "Update balance" : "Edit account") : "Add manual account"
      }
      desc={
        linked
          ? "The balance and currency come from the provider and can't be edited here."
          : "Manual accounts are updated by you."
      }
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
        {!balance && (
          <Field label="Name" id="ac-n" error={err}>
            <Input
              id="ac-n"
              value={f.name}
              onInput={up("name")}
              placeholder="e.g. Cash ISA"
            />
          </Field>
        )}
        {!balance && (
          <div className="form-2">
            <Field label="Type" id="ac-t">
              <Sel
                id="ac-t"
                value={f.type}
                onChange={up("type")}
                options={ACCOUNT_TYPES}
              />
            </Field>
            <Field
              label="Currency"
              id="ac-c"
              hint={linked ? "Set by the provider" : "Values aren't converted"}
            >
              <Sel
                id="ac-c"
                value={f.cur}
                onChange={up("cur")}
                options={["GBP", "USD", "EUR"]}
              />
            </Field>
          </div>
        )}
        {!linked && (
          <>
            <Seg
              value={balanceType}
              label="Balance type"
              options={[
                { v: "current", l: "Current balance" },
                { v: "opening", l: "Opening balance" },
              ]}
              onChange={(type) => {
                setBalanceType(type);
                up("amount")(
                  (
                    ((type === "opening" ? stored?.openingBalance : a?.bal) ??
                      0) / 100
                  ).toFixed(2),
                );
              }}
            />
            {balanceType === "opening" && (
              <Field
                label="Opening date"
                id="ac-date"
                hint="Balance at the start of this day, before its transactions."
              >
                <DateField
                  id="ac-date"
                  value={openingDate}
                  onChange={setOpeningDate}
                  max={TODAY}
                />
              </Field>
            )}
            <Field
              label={
                balanceType === "opening"
                  ? "Opening balance"
                  : "Current balance"
              }
              id="ac-b"
              error={err}
              hint={
                balanceType === "opening"
                  ? "Changing this baseline recalculates balances from that date. Transactions and spending history are kept."
                  : undefined
              }
            >
              <MoneyInput
                id="ac-b"
                value={f.amount}
                onInput={up("amount")}
                cur={f.cur}
              />
            </Field>
          </>
        )}
        {!balance && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div className="field-label">Include in totals</div>
              <div className="field-hint">
                Only GBP accounts are added to totals
              </div>
            </div>
            <Switch
              on={f.inNet}
              label="Include in totals"
              onChange={up("inNet")}
            />
          </div>
        )}
      </div>
    </Dialog>
  );
}

export function ReconcileDialog({ a }: { a: AccountRow }) {
  const [date, setDate] = useState(TODAY);
  const [stmt, setStmt] = useState("");
  const { busy, submit } = useSubmit();
  const p = parseMoney(stmt);
  const account = dashboard.finance.data.accounts.find(
    (account) => account.id === a.id,
  );
  const unavailable = !sampleMode && (!account || date < account.openingDate);
  const datedBalance = sampleMode
    ? a.bal -
      S.txns
        .filter(
          (row) =>
            row.acct === a.id &&
            row.status === "cleared" &&
            row.date > date &&
            row.date <= TODAY,
        )
        .reduce((sum, row) => sum + row.amt, 0)
    : account
      ? ledgerBalance(dashboard.finance.data, account, date)
      : 0;
  const diff = p == null || unavailable ? null : p - datedBalance;
  return (
    <Dialog
      title={`Reconcile ${a.name}`}
      desc="Compare Cresco's balance with the closing balance on a statement."
      foot={
        <>
          <Btn onClick={closeDialog}>Cancel</Btn>
          {p !== null && diff !== null && diff !== 0 ? (
            <Btn
              v="primary"
              disabled={busy}
              onClick={() =>
                void submit(
                  reconcile(a, p, date, diff),
                  `Adjustment of ${money(diff, { sign: true })} added`,
                  { undo: true },
                )
              }
            >
              Add adjustment and reconcile
            </Btn>
          ) : (
            <Btn
              v="primary"
              disabled={busy || diff === null}
              onClick={() =>
                diff === 0 &&
                p !== null &&
                void submit(reconcile(a, p, date, 0), a.name + " reconciled")
              }
            >
              Mark reconciled
            </Btn>
          )}
        </>
      }
    >
      <div className="form-2">
        <Field label="Statement date" id="rc-d">
          <DateField id="rc-d" value={date} onChange={setDate} max={TODAY} />
        </Field>
        <Field label="Statement balance" id="rc-b">
          <MoneyInput id="rc-b" value={stmt} onInput={setStmt} cur={a.cur} />
        </Field>
      </div>
      <dl className="kv">
        <dt>Balance on {dshort(date)}</dt>
        <dd>
          {unavailable ? "Unavailable" : money(datedBalance, { cur: a.cur })}
        </dd>
        <dt>Statement</dt>
        <dd>{p == null ? "—" : money(p, { cur: a.cur })}</dd>
        <dt>Difference</dt>
        <dd className={cx("strong", diff ? "neg" : diff === 0 && "pos")}>
          {diff == null
            ? "—"
            : diff === 0
              ? "Balanced"
              : money(diff, { sign: true, cur: a.cur })}
        </dd>
      </dl>
      {unavailable && (
        <p role="status" className="meta">
          Set an opening balance on or before this statement date in Edit
          account first.
        </p>
      )}
      {!!diff && (
        <div className="meta">
          Check for missing or duplicate transactions first. An adjustment makes
          the balances match without explaining the difference.
        </div>
      )}
    </Dialog>
  );
}
