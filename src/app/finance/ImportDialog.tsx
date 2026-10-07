import { useEffect, useRef, useState } from "react";

import { dshort } from "../core/dates";
import { money } from "../core/format";
import { S, closeDialog, dashboard } from "../core/state";
import { Btn, Check, Field, I, Sel } from "../ui/controls";
import { Dialog } from "../ui/layout";
import { useSubmit } from "../ui/useSubmit";
import { importRows } from "./commands";
import { ImportCorrections } from "./ImportCorrections";

import {
  ROW_CATS,
  type ReviewRow,
  type ReviewCorrection,
  readStatement,
  suggestCategories,
} from "./statement";
import { merchantKey } from "../../features/finance/merchants";

export function ImportDialog() {
  return <RealImportDialog />;
}

const reason = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

function RealImportDialog() {
  const picker = useRef<HTMLInputElement>(null);
  const suggestionRun = useRef(0);
  useEffect(
    () => () => {
      suggestionRun.current++;
    },
    [],
  );
  const [accountId, setAccountId] = useState(
    S.accounts.find((account) => !account.archived)?.id || "",
  );
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [duplicates, setDuplicates] = useState(0);
  const [corrections, setCorrections] = useState<ReviewCorrection[]>([]);
  const [sourceRows, setSourceRows] = useState(0);
  const [excluded, setExcluded] = useState(0);
  const [reverted, setReverted] = useState(0);
  const [feeRows, setFeeRows] = useState(0);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [sortProgress, setSortProgress] = useState({ done: 0, total: 0 });
  const [step, setStep] = useState<1 | 2>(1);
  const { busy: saving, submit } = useSubmit();
  const busy = reading || saving;
  const account = dashboard.finance.data.accounts.find(
    (item) => item.id === accountId,
  );
  const included = rows.filter((row) => row.on);
  const includedCorrections = corrections.filter((row) => row.on);
  const edit = (index: number, change: Partial<ReviewRow>) =>
    setRows(rows.map((row, i) => (i === index ? { ...row, ...change } : row)));
  const chooseCategory = (index: number, category: string) => {
    const selected = rows[index];
    const merchant = merchantKey(selected.description);
    setRows(
      rows.map((row, i) =>
        i === index ||
        (row.on &&
          (row.category === "Uncategorised" ||
            (row.categorySource === "suggested" &&
              selected.categorySource === "suggested" &&
              row.category === selected.category)) &&
          merchantKey(row.description) === merchant &&
          row.kind === selected.kind)
          ? {
              ...row,
              category,
              categorySource: "manual",
              suggestedReview: undefined,
              suggestion: null,
            }
          : row,
      ),
    );
  };

  /** Keeping confirms Suggested's merchant pick for every row it covered, and saves a rule. */
  const keepPick = (index: number) => {
    const selected = rows[index];
    const merchant = merchantKey(selected.description);
    setRows(
      rows.map((row, i) =>
        i === index ||
        (row.categorySource === "suggested" &&
          row.suggestedReview === "unsure" &&
          row.category === selected.category &&
          merchantKey(row.description) === merchant &&
          row.kind === selected.kind)
          ? {
              ...row,
              categorySource: "manual",
              suggestedReview: undefined,
              suggestion: null,
            }
          : row,
      ),
    );
  };

  const chooseFile = async (selected: File | undefined) => {
    if (!selected) return;
    setReading(true);
    setError("");
    setSortProgress({ done: 0, total: 0 });
    const run = ++suggestionRun.current;
    try {
      const statement = await readStatement(selected, accountId);
      setRows(statement.rows);
      setDuplicates(statement.duplicates);
      setCorrections(statement.corrections);
      setSourceRows(statement.sourceRows);
      setExcluded(statement.excluded);
      setReverted(statement.reverted);
      setFeeRows(statement.feeRows);
      setFile(selected);
      const sorted = await suggestCategories(
        statement.rows,
        () => run === suggestionRun.current,
        (done, total) => setSortProgress({ done, total }),
      );
      if (run !== suggestionRun.current) return;
      setRows(sorted.rows);
      setError(sorted.error);
    } catch (e) {
      setError(reason(e));
      setFile(null);
      setRows([]);
      setCorrections([]);
    } finally {
      setReading(false);
      if (picker.current) picker.current.value = "";
    }
  };
  const save = () => {
    if (!file || (!included.length && !includedCorrections.length)) return;
    void submit(
      importRows(
        {
          accountId,
          name: file.name,
          count: included.length,
          duplicateCount: duplicates,
        },
        included.map(
          ({ on: _on, suggestion: _s, ...transaction }) => transaction,
        ),
        [],
        includedCorrections.map(
          ({ on: _on, date: _date, description: _description, ...amounts }) =>
            amounts,
        ),
      ),
      includedCorrections.length
        ? `Added ${included.length} transaction${included.length === 1 ? "" : "s"} · corrected ${includedCorrections.length}`
        : `Imported ${included.length} transaction${included.length === 1 ? "" : "s"}`,
    );
  };

  return (
    <Dialog
      title="Import a statement"
      desc={
        step === 1 || !file
          ? "Step 1 of 2 · choose a CSV file exported from your bank."
          : `Step 2 of 2 · review ${rows.length} new · ${corrections.length} amount/type corrections.`
      }
      xwide
      foot={
        step === 1 ? (
          <>
            <Btn onClick={closeDialog}>Cancel</Btn>
            <Btn
              v="primary"
              disabled={!file || busy}
              onClick={() => setStep(2)}
            >
              Review rows
            </Btn>
          </>
        ) : (
          <>
            <Btn
              onClick={() => {
                suggestionRun.current++;
                setReading(false);
                setStep(1);
              }}
            >
              Back
            </Btn>
            <span className="grow" />
            <Btn onClick={closeDialog}>Cancel</Btn>
            <Btn
              v="primary"
              disabled={
                busy || (!included.length && !includedCorrections.length)
              }
              onClick={save}
            >
              {includedCorrections.length
                ? `Apply ${included.length} new · ${includedCorrections.length} correction${includedCorrections.length === 1 ? "" : "s"}`
                : `Import ${included.length} transaction${included.length === 1 ? "" : "s"}`}
            </Btn>
          </>
        )
      }
    >
      {error && (
        <div role="alert" className="field-error">
          {error}
        </div>
      )}
      {step === 1 ? (
        <div className="form">
          <Field label="Import into" id="real-import-account">
            <Sel
              id="real-import-account"
              value={accountId}
              onChange={(value) => {
                setAccountId(value);
                setFile(null);
                setRows([]);
                setCorrections([]);
              }}
              options={S.accounts
                .filter((item) => !item.archived)
                .map((item) => ({ v: item.id, l: item.name }))}
            />
          </Field>
          <input
            ref={picker}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-label="CSV statement"
            onChange={(event) => void chooseFile(event.target.files?.[0])}
          />
          <div className="drop">
            <I n="file-up" s={22} />
            <div>
              {reading && sortProgress.total
                ? `Reviewing ${sortProgress.done} of ${sortProgress.total} merchant groups`
                : file
                  ? `${file.name} · ${rows.length} new · ${corrections.length} corrections`
                  : "Choose a CSV statement"}
            </div>
            <Btn
              sm
              disabled={busy || !account}
              onClick={() => picker.current?.click()}
            >
              Choose file
            </Btn>
            <div className="meta">
              {file
                ? `${sourceRows} statement rows · ${duplicates} already saved · ${reverted} reverted · ${excluded - reverted} other excluded · ${feeRows} with fees. Nothing changes until you review and apply.`
                : "Nothing is added until you review and import."}
            </div>
          </div>
        </div>
      ) : (
        <>
          <p className="meta">{`${sourceRows} statement rows: ${rows.length} new, ${corrections.length} amount/type corrections, ${duplicates} already saved, ${excluded} excluded (${reverted} reverted). Amounts include separate Revolut fees.`}</p>
          <p className="meta">
            Choosing a category updates included uncategorised rows and rows
            covered by the same Suggested merchant decision. Other choices are
            kept. Edit exceptions individually after import. Set the account
            opening balance, then compare its balance with the statement under
            Accounts.
          </p>
          <ImportCorrections
            rows={corrections}
            currency={account?.currency}
            onToggle={(index, on) =>
              setCorrections(
                corrections.map((item, i) =>
                  i === index ? { ...item, on } : item,
                ),
              )
            }
          />
          <p className="meta" role="status">
            {sortProgress.total
              ? `Reviewed ${sortProgress.done} of ${sortProgress.total} distinct merchants. Unsure picks have a Keep.`
              : "Saved rules and known merchants applied. Choose categories for any remaining rows."}
          </p>
          <div
            className="table-wrap"
            style={{ maxHeight: "52vh", overflow: "auto" }}
          >
            <table className="t">
              <thead>
                <tr>
                  <th className="w-check">Include</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th className="num">Amount</th>
                  <th>Category</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id}>
                    <td>
                      <Check
                        on={row.on}
                        label={`Include ${row.description}`}
                        onChange={(on) => edit(index, { on })}
                      />
                    </td>
                    <td>{dshort(row.date)}</td>
                    <td>{row.description}</td>
                    <td className="num">
                      {money(row.amount, { cur: account?.currency })}
                    </td>
                    <td>
                      <Sel
                        cls="w-auto"
                        value={row.category}
                        label={`Category for ${row.description}`}
                        onChange={(category) => chooseCategory(index, category)}
                        options={ROW_CATS}
                      />
                    </td>
                    <td>
                      {row.categorySource === "suggested" ? (
                        <>
                          <span className="meta">
                            {row.suggestedReview === "unsure"
                              ? "Suggested · unsure"
                              : "Suggested"}
                          </span>
                          {row.suggestedReview === "unsure" && (
                            <Btn sm onClick={() => keepPick(index)}>
                              Keep
                            </Btn>
                          )}
                        </>
                      ) : (
                        <span className="meta">
                          {row.categorySource === "known"
                            ? "Known merchant"
                            : row.categorySource === "rule"
                              ? "Your rule"
                              : row.categorySource === "manual"
                                ? "You"
                                : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Dialog>
  );
}
