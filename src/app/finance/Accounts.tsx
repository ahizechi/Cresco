import { Fragment, useState } from "react";
import { sampleMode } from "@sample";
import { apply } from "../core/commands";
import { dshort } from "../core/dates";
import { money } from "../core/format";
import { S, confirmDialog, openDialog } from "../core/state";
import type { AccountRow, MenuItem } from "../core/view";
import type { IconName } from "../ui/icons";
import { Btn, Chip, I, Tile } from "../ui/controls";
import { Panel, Row, RowMenu } from "../ui/layout";
import { setArchived } from "./commands";

const ICONS: Record<string, IconName> = {
  "Credit card": "credit-card",
  Investment: "trending-up",
  Pension: "piggy-bank",
  Savings: "wallet",
};

function accountMenu(a: AccountRow): MenuItem[] {
  return [
    { l: "Edit", i: "pencil", f: () => openDialog("account", { a }) },
    { l: "Reconcile…", i: "scale", f: () => openDialog("reconcile", { a }) },
    ...(a.source === "Manual"
      ? [
          {
            l: "Update balance…",
            i: "pencil" as const,
            f: () => openDialog("account", { a, balance: true }),
          },
        ]
      : []),
    { sep: true },
    {
      l: "Archive…",
      i: "archive",
      f: () =>
        confirmDialog({
          title: `Archive ${a.name}?`,
          text: "It leaves your totals and account lists. Its transactions stay in the ledger, and you can restore it at any time.",
          ok: "Archive account",
          f: () =>
            void apply(setArchived(a.id, true), `${a.name} archived`, {
              undo: true,
            }),
        }),
    },
  ];
}

export function FinAccounts() {
  const [showArch, setShowArch] = useState(false);
  const live = S.accounts.filter((a) => !a.archived);
  const arch = S.accounts.filter((a) => a.archived);
  const groups = sampleMode
    ? ["Current", "Savings", "Credit card", "Investment", "Pension"]
    : ["Current", "Savings", "Credit card", "Cash"];
  const accountGroups = groups
    .map((g) => [g, live.filter((a) => a.type === g)] as const)
    .filter(([, rows]) => rows.length);
  return (
    <div className="view">
      <Panel
        flush
        list
        isEmpty={live.length === 0}
        empty={{
          icon: "wallet",
          title: "No accounts yet",
          text: sampleMode
            ? "Link a bank, or add a manual account for cash or a pension."
            : "Add an account, then import a bank statement. UK bank feeds are not connected.",
          action: (
            <Btn sm i="plus" onClick={() => openDialog("account")}>
              Add account
            </Btn>
          ),
        }}
        title="Accounts"
        detail="Reconciled means the balance was checked against a statement."
        actions={
          <Btn sm i="plus" onClick={() => openDialog("account")}>
            Add manual account
          </Btn>
        }
      >
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Account</th>
                <th>Source</th>
                <th>Updated</th>
                <th>Reconciled</th>
                <th className="num">Balance</th>
                <th className="w-act">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {accountGroups.map(([g, rows]) => (
                <Fragment key={g}>
                  <tr>
                    <td
                      colSpan={6}
                      className="meta"
                      style={{ paddingTop: "14px", background: "transparent" }}
                    >
                      {g}
                    </td>
                  </tr>
                  {rows.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            gap: "10px",
                            alignItems: "center",
                          }}
                        >
                          <Tile i={ICONS[a.type] ?? "landmark"} sm plain />
                          <div>
                            <div>{a.name}</div>
                            <div className="row-sub">
                              {a.inst === "Manual" ? "Manual account" : a.inst}
                              {a.cur !== "GBP" ? " · " + a.cur : ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Chip k="outline">
                          {a.source === "Manual"
                            ? "Manual"
                            : a.source === "Trading 212"
                              ? "Trading 212 · read-only"
                              : "Bank link"}
                        </Chip>
                      </td>
                      <td className="muted">{a.synced}</td>
                      <td className="muted">
                        {a.reconciled ? dshort(a.reconciled) : "—"}
                      </td>
                      <td className="num">
                        <span className={a.bal < 0 ? "neg" : ""}>
                          {money(a.bal, { cur: a.cur })}
                        </span>
                        {a.cur !== "GBP" && (
                          <div className="row-sub">Not in GBP totals</div>
                        )}
                      </td>
                      <td className="w-act">
                        <RowMenu
                          items={accountMenu(a)}
                          label={"Actions for " + a.name}
                        />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {arch.length > 0 && (
          <div className="pager">
            <button
              type="button"
              className="btn muted-ghost sm"
              onClick={() => setShowArch(!showArch)}
              aria-expanded={showArch}
            >
              <I n={showArch ? "chevron-down" : "chevron-right"} s={14} />
              {`${arch.length} archived account${arch.length === 1 ? "" : "s"}`}
            </button>
          </div>
        )}
        {showArch && arch.length > 0 && (
          <div className="rows" style={{ padding: "0 20px 8px" }}>
            {arch.map((a) => (
              <Row
                key={a.id}
                icon="archive"
                title={a.name}
                sub={a.synced}
                end={
                  <Btn
                    sm
                    i="archive-restore"
                    onClick={() =>
                      void apply(setArchived(a.id, false), a.name + " restored")
                    }
                  >
                    Restore
                  </Btn>
                }
              />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
