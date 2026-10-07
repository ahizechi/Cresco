import { ImportHistory } from "./ImportHistory";
import { useState } from "react";
import { TODAY, dshort } from "../core/dates";
import { money } from "../core/format";
import { S, openDialog, openMenu } from "../core/state";
import { Btn, Check, Chip, I, Sel, Status } from "../ui/controls";
import { Empty, Panel, RowMenu } from "../ui/layout";
import { exportTransactions } from "./actions";
import { CategoryReview } from "./CategoryReview";
import { BulkBar } from "./BulkBar";
import { Amount, categoryItems, txMenu } from "./rows";
import { CATS, acctName, transferAccount } from "./selectors";
import { keepSuggestedCategory } from "./commands";
import { apply } from "../core/commands";
import {
  NO_FILTERS,
  PER_PAGE,
  filterTxns,
  monthOptions,
  moneyOut,
  type Filters,
  type Sort,
} from "./txn-filters";

export function FinTransactions() {
  const [f, setF] = useState<Filters>({
    ...NO_FILTERS,
    month: TODAY.slice(0, 7),
  });
  const [sort, setSort] = useState<Sort>({ k: "date", dir: -1 });
  const [sel, setSel] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const filter = (patch: Partial<Filters>) => {
    setF({ ...f, ...patch });
    setPage(0);
  };
  const rows = filterTxns(S.txns, f, sort);
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const pg = Math.min(page, pages - 1);
  const shown = rows.slice(pg * PER_PAGE, pg * PER_PAGE + PER_PAGE);
  const allSel = shown.length > 0 && shown.every((t) => sel.includes(t.id));
  const sortBy = (k: Sort["k"]) =>
    setSort((s) => ({ k, dir: s.k === k ? (-s.dir as Sort["dir"]) : -1 }));
  const arrow = (k: Sort["k"]) =>
    sort.k === k ? (sort.dir < 0 ? " ↓" : " ↑") : "";
  const ariaSort = (k: Sort["k"]) =>
    sort.k === k ? (sort.dir < 0 ? "descending" : "ascending") : "none";
  const filtered = f.q || f.acc !== "all" || f.cat !== "all" || f.st !== "all";
  return (
    <div className="view">
      <CategoryReview />
      <ImportHistory />
      {sel.length > 0 && <BulkBar sel={sel} clear={() => setSel([])} />}
      <Panel
        flush
        list
        isEmpty={S.txns.length === 0}
        empty={{
          icon: "receipt-text",
          title: "No transactions yet",
          text: "Link a bank or import a CSV statement from your bank.",
          action: (
            <Btn sm i="upload" onClick={() => openDialog("import")}>
              Import statement
            </Btn>
          ),
        }}
      >
        <div className="toolbar transactions-toolbar">
          <div className="input-icon transactions-search">
            <I n="search" />
            <input
              className="input"
              placeholder="Search merchant, note or category"
              value={f.q}
              onInput={(e) => filter({ q: e.currentTarget.value })}
              aria-label="Search transactions"
            />
          </div>
          <Sel
            cls="w-auto"
            label="Month"
            value={f.month}
            onChange={(month) => filter({ month })}
            options={monthOptions(S.txns)}
          />
          <Sel
            cls="w-auto"
            label="Account"
            value={f.acc}
            onChange={(acc) => filter({ acc })}
            options={[{ v: "all", l: "All accounts" }].concat(
              S.accounts
                .filter(
                  (a) =>
                    !a.archived &&
                    a.source !== "Trading 212" &&
                    a.type !== "Pension",
                )
                .map((a) => ({ v: a.id, l: acctName(a.id) })),
            )}
          />
          <Sel
            cls="w-auto"
            label="Category"
            value={f.cat}
            onChange={(cat) => filter({ cat })}
            options={[{ v: "all", l: "All categories" }].concat(
              Object.keys(CATS).map((c) => ({ v: c, l: c })),
            )}
          />
          <Sel
            cls="w-auto"
            label="Status"
            value={f.st}
            onChange={(st) =>
              filter({ st, month: st === "unsure" ? "all" : f.month })
            }
            options={[
              { v: "all", l: "Any status" },
              { v: "cleared", l: "Cleared" },
              { v: "pending", l: "Pending" },
              { v: "transfer", l: "Transfers" },
              { v: "review", l: "Uncategorised" },
              { v: "unsure", l: "Unsure" },
            ]}
          />
          {filtered && (
            <Btn v="muted-ghost" sm onClick={() => filter(NO_FILTERS)}>
              Clear filters
            </Btn>
          )}
          <span className="flex-fill" />
          <Btn i="download" onClick={() => void exportTransactions(rows)}>
            Export CSV
          </Btn>
        </div>
        {rows.length === 0 ? (
          <Empty
            icon="search"
            title="No matching transactions"
            text="Try a different month, account or category."
            action={
              <Btn sm onClick={() => filter({ ...NO_FILTERS, month: "all" })}>
                Clear filters
              </Btn>
            }
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="t tight">
                <thead>
                  <tr>
                    <th className="w-check">
                      <Check
                        on={allSel}
                        mixed={!allSel && shown.some((t) => sel.includes(t.id))}
                        label="Select all on this page"
                        onChange={(on) =>
                          setSel(
                            on
                              ? [
                                  ...new Set([
                                    ...sel,
                                    ...shown.map((t) => t.id),
                                  ]),
                                ]
                              : sel.filter(
                                  (id) => !shown.some((t) => t.id === id),
                                ),
                          )
                        }
                      />
                    </th>
                    <th
                      className="sortable"
                      onClick={() => sortBy("date")}
                      aria-sort={ariaSort("date")}
                    >
                      Date{arrow("date")}
                    </th>
                    <th>Merchant</th>
                    <th>Category</th>
                    <th>Account</th>
                    <th>Status</th>
                    <th
                      className="num sortable"
                      onClick={() => sortBy("amt")}
                      aria-sort={ariaSort("amt")}
                    >
                      Amount{arrow("amt")}
                    </th>
                    <th className="w-act">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((t) => (
                    <tr
                      key={t.id}
                      className={sel.includes(t.id) ? "selected" : ""}
                    >
                      <td className="w-check">
                        <Check
                          on={sel.includes(t.id)}
                          label={"Select " + t.merchant}
                          onChange={(on) =>
                            setSel(
                              on
                                ? [...sel, t.id]
                                : sel.filter((x) => x !== t.id),
                            )
                          }
                        />
                      </td>
                      <td className="muted">{dshort(t.date)}</td>
                      <td>
                        <div className="transaction-merchant">
                          {t.merchant}
                          {t.source === "CSV import" && (
                            <Chip
                              k="neutral"
                              title="Imported from a CSV statement"
                            >
                              CSV
                            </Chip>
                          )}
                          {t.categorySource === "suggested" && (
                            <Chip k="outline">
                              {t.suggestedReview === "unsure"
                                ? "Suggested · unsure"
                                : "Suggested"}
                            </Chip>
                          )}
                          {t.note && (
                            <span title={t.note}>
                              <I n="message-square" s={13} cls="subtle" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {t.transfer ? (
                          <Chip k="neutral">
                            {`Transfer · ${transferAccount(t)?.inst ?? "another account"}`}
                          </Chip>
                        ) : (
                          <div className="transaction-category-cell">
                            <button
                              type="button"
                              className="chip bordered transaction-category"
                              onClick={(e) =>
                                openMenu(e, categoryItems(t), "start")
                              }
                            >
                              {t.cat}
                            </button>
                            {t.suggestedReview === "unsure" && (
                              <Btn
                                sm
                                onClick={() =>
                                  void apply(
                                    keepSuggestedCategory(t.id),
                                    `${t.merchant} kept`,
                                    { undo: true },
                                  )
                                }
                              >
                                Keep
                              </Btn>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="muted">{acctName(t.acct)}</td>
                      <td>
                        <Status s={t.status} />
                      </td>
                      <td className="num">
                        <Amount t={t} />
                      </td>
                      <td className="w-act">
                        <RowMenu items={txMenu(t)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pager">
              <span className="meta num">{`Showing ${pg * PER_PAGE + 1}–${Math.min(rows.length, pg * PER_PAGE + PER_PAGE)} of ${rows.length} · money out ${money(moneyOut(rows))}`}</span>
              <div className="pager-controls">
                <Btn
                  sm
                  icon
                  i="chevron-left"
                  aria-label="Previous page"
                  disabled={pg === 0}
                  onClick={() => setPage(pg - 1)}
                />
                <span className="meta num pager-label">
                  {`Page ${pg + 1} of ${pages}`}
                </span>
                <Btn
                  sm
                  icon
                  i="chevron-right"
                  aria-label="Next page"
                  disabled={pg >= pages - 1}
                  onClick={() => setPage(pg + 1)}
                />
              </div>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
