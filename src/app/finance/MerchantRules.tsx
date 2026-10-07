import { useState } from "react";
import { apply } from "../core/commands";
import { confirmDialog, dashboard } from "../core/state";
import { Btn, Sel } from "../ui/controls";
import { deleteMerchantRule, updateMerchantRule } from "./commands";
import { SPEND_CATS } from "./selectors";

export function MerchantRules() {
  const [open, setOpen] = useState(false);
  const rules = dashboard.finance.data.rules;
  if (!rules.length) return null;
  return (
    <div className="category-rules">
      <div className="category-rules-head">
        <div>
          <strong>{`Saved merchant rules (${rules.length})`}</strong>
          <p className="meta">
            Rules classify future CSV imports. Editing a rule does not rewrite
            saved transactions.
          </p>
        </div>
        <Btn
          sm
          v="muted-ghost"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          {open ? "Hide rules" : "Manage rules"}
        </Btn>
      </div>
      {open && (
        <div className="table-wrap">
          <table className="t tight">
            <thead>
              <tr>
                <th>Match</th>
                <th>Transaction type</th>
                <th>Category for future imports</th>
                <th className="w-act">Action</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => {
                const choices =
                  rule.kind === "income"
                    ? ["Income", "Salary", "Other income"]
                    : SPEND_CATS;
                const options = choices.includes(rule.category)
                  ? choices
                  : [rule.category, ...choices];
                return (
                  <tr key={rule.id}>
                    <td>
                      <span className="meta">
                        {rule.match === "exact" ? "Exact" : "Contains"} ·{" "}
                      </span>
                      {rule.contains}
                    </td>
                    <td>{rule.kind}</td>
                    <td>
                      <Sel
                        label={`Future category for ${rule.contains}`}
                        cls="w-auto"
                        value={rule.category}
                        options={options}
                        onChange={(category) =>
                          void apply(
                            updateMerchantRule(rule.id, category),
                            "Rule updated",
                            { undo: true },
                          )
                        }
                      />
                    </td>
                    <td>
                      <Btn
                        sm
                        v="muted-ghost"
                        i="trash-2"
                        aria-label={`Remove rule for ${rule.contains}`}
                        onClick={() =>
                          confirmDialog({
                            title: "Remove merchant rule?",
                            text: `Future imports will no longer categorise ${rule.contains} using this rule. Saved transactions stay as they are.`,
                            ok: "Remove rule",
                            f: () =>
                              void apply(
                                deleteMerchantRule(rule.id),
                                "Rule removed",
                                { undo: true },
                              ),
                          })
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
