import { merchantKey } from "../../features/finance/merchants";
import { addDays } from "../core/dates";
import { S } from "../core/state";

const stamp = (day: string) => new Date(`${day}T12:00:00`).getTime();

/** Two comparable GBP charges 25–35 days apart are a candidate, not proof of a subscription. */
export function recurringFromLedger() {
  const gbp = new Set(
    S.accounts
      .filter((account) => account.cur === "GBP")
      .map((account) => account.id),
  );
  const groups = new Map<string, typeof S.txns>();
  for (const row of S.txns.filter(
    (item) =>
      gbp.has(item.acct) &&
      item.status === "cleared" &&
      item.amt < 0 &&
      !item.transfer &&
      item.cat !== "Transfer",
  )) {
    const key = merchantKey(row.merchant);
    if (key.length < 3) continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()]
    .flatMap(([key, rows]) => {
      rows.sort((a, b) => a.date.localeCompare(b.date));
      if (rows.length < 2) return [];
      const last = rows[rows.length - 1],
        prior = rows[rows.length - 2];
      const gap = Math.round(
        (stamp(last.date) - stamp(prior.date)) / 86_400_000,
      );
      if (
        gap < 25 ||
        gap > 35 ||
        Math.abs(last.amt - prior.amt) >
          Math.max(100, Math.abs(last.amt) * 0.05)
      )
        return [];
      return [
        {
          key,
          name: last.merchant,
          amount: Math.abs(last.amt),
          next: addDays(last.date, gap),
        },
      ];
    })
    .sort((a, b) => a.next.localeCompare(b.next));
}
