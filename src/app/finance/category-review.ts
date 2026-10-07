import type { FinanceData, Transaction } from "../../features/finance/model";
import { merchantKey } from "../../features/finance/merchants";

export { merchantKey };

export interface MerchantGroup {
  key: string;
  description: string;
  kind: "expense" | "income";
  ids: string[];
  count: number;
}

/** One decision can categorise a repeated CSV merchant across all dates. */
export function uncategorisedGroups(rows: Transaction[]): MerchantGroup[] {
  const groups = new Map<string, MerchantGroup>();
  for (const row of rows) {
    if (
      row.category !== "Uncategorised" ||
      !["expense", "income"].includes(row.kind)
    )
      continue;
    const key = `${row.kind}:${merchantKey(row.description)}`;
    const group = groups.get(key) ?? {
      key,
      description: row.description,
      kind: row.kind as "expense" | "income",
      ids: [],
      count: 0,
    };
    group.ids.push(row.id);
    group.count++;
    groups.set(key, group);
  }
  return [...groups.values()].sort(
    (a, b) => b.count - a.count || a.description.localeCompare(b.description),
  );
}

export function categoriseMerchant(
  data: FinanceData,
  group: MerchantGroup,
  category: string,
  remember: boolean,
  ruleId: string,
  model?: { unsure: boolean },
): FinanceData {
  if (!category || category === "Uncategorised")
    throw new Error("Choose a category first.");
  const ids = new Set(group.ids);
  let changed = 0;
  const transactions = data.transactions.map((row) => {
    if (
      !ids.has(row.id) ||
      row.category !== "Uncategorised" ||
      row.kind !== group.kind ||
      merchantKey(row.description) !== merchantKey(group.description)
    )
      return row;
    changed++;
    return {
      ...row,
      category,
      categorySource: model ? ("suggested" as const) : ("manual" as const),
      suggestedReview: model?.unsure ? ("unsure" as const) : undefined,
    };
  });
  if (!changed)
    throw new Error("These transactions changed. Refresh the review list.");
  const exact = merchantKey(group.description);
  const prior = data.rules.find(
    (rule) =>
      rule.match === "exact" &&
      rule.kind === group.kind &&
      merchantKey(rule.contains) === exact,
  );
  return {
    ...data,
    transactions,
    rules: !remember
      ? data.rules
      : prior
        ? data.rules.map((rule) =>
            rule === prior ? { ...rule, category } : rule,
          )
        : [
            {
              id: ruleId,
              contains: exact,
              category,
              kind: group.kind,
              match: "exact",
            },
            ...data.rules,
          ],
  };
}
