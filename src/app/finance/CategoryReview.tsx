import { useState } from "react";
import { apply } from "../core/commands";
import { dashboard } from "../core/state";
import { Btn, Sel } from "../ui/controls";
import { Panel } from "../ui/layout";
import { uncategorisedGroups } from "./category-review";
import { setMerchantCategories } from "./commands";
import { MerchantRules } from "./MerchantRules";
import { SPEND_CATS } from "./selectors";
export function CategoryReview() {
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const groups = uncategorisedGroups(dashboard.finance.data.transactions);
  const count = dashboard.finance.data.rules.length;
  if (!groups.length && !count) return null;
  const current = Math.min(
    page,
    Math.max(0, Math.ceil(groups.length / 10) - 1),
  );
  const visible = groups.slice(current * 10, current * 10 + 10);
  return (
    <Panel
      title="Category rules"
      detail="Saved rules and known merchants classify imports locally. Review remaining categories here."
      actions={
        <Btn sm onClick={() => setOpen(!open)}>
          {open ? "Close" : "Review categories"}
        </Btn>
      }
    >
      {open && (
        <>
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>Merchant</th>
                  <th>Rows</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((g) => (
                  <tr key={g.key}>
                    <td>{g.description}</td>
                    <td>{g.count}</td>
                    <td>
                      <Sel
                        label={"Category for " + g.description}
                        value={choices[g.key] || "Uncategorised"}
                        options={[
                          "Uncategorised",
                          ...(g.kind === "income"
                            ? ["Income", "Salary", "Other income"]
                            : SPEND_CATS),
                        ]}
                        onChange={(v) => setChoices({ ...choices, [g.key]: v })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <Btn disabled={current === 0} onClick={() => setPage(current - 1)}>
              Previous
            </Btn>
            <span>{groups.length} merchant groups</span>
            <Btn
              disabled={(current + 1) * 10 >= groups.length}
              onClick={() => setPage(current + 1)}
            >
              Next
            </Btn>
            <Btn
              v="primary"
              disabled={
                !visible.some(
                  (g) => choices[g.key] && choices[g.key] !== "Uncategorised",
                )
              }
              onClick={async () => {
                for (const g of visible) {
                  const category = choices[g.key];
                  if (category && category !== "Uncategorised")
                    await apply(
                      setMerchantCategories([{ group: g, category }], true),
                      "Category saved",
                      { undo: true },
                    );
                }
                setChoices({});
              }}
            >
              Apply categories
            </Btn>
          </div>
          <MerchantRules />
        </>
      )}
    </Panel>
  );
}
