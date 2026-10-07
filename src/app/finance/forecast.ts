// Upcoming bills and income, and the projected balance they produce.
import { sampleMode } from "@sample";
import { occurrences } from "../../features/finance/model";
import { TODAY, addDays } from "../core/dates";
import { S, dashboard } from "../core/state";
import { advance } from "./commands";

/** Bills and income due in the next 30 days, as payment counts and totals. */
export function next30Days() {
  const due = sampleMode
    ? S.schedules
        .filter((s) => s.next >= TODAY && s.next <= addDays(TODAY, 30))
        .map((s) => ({ kind: s.kind, amt: s.amt }))
    : occurrences(dashboard.finance.data, TODAY, addDays(TODAY, 30)).map(
        (d) => ({
          kind: d.item.kind === "income" ? "income" : "bill",
          amt: d.item.amount,
        }),
      );
  const bills = due.filter((d) => d.kind === "bill");
  const income = due.filter((d) => d.kind === "income");
  return {
    bills: bills.length,
    out: bills.reduce((a, d) => a + Math.abs(d.amt), 0),
    incomes: income.length,
    in: income.reduce((a, d) => a + d.amt, 0),
  };
}

/** The first non-archived GBP account, which the projection follows. */
export const forecastAccount = () =>
  S.accounts.find((account) => !account.archived && account.cur === "GBP");

/**
 * Daily balances of the forecast account for `range` days, from scheduled
 * bills and income less an everyday spend per day.
 */
export function projection(range: number, daily: number): number[] {
  const account = forecastAccount();
  const dues = sampleMode
    ? []
    : occurrences(dashboard.finance.data, TODAY, addDays(TODAY, range));
  const schedules = sampleMode
    ? S.schedules.filter((x) => x.acct === account?.id && x.next && !x.paused)
    : [];
  const pts: number[] = [];
  let bal = account?.bal || 0;
  for (let i = 0; i <= range; i++) {
    const day = addDays(TODAY, i);
    if (i > 0) bal -= daily;
    for (const s of schedules)
      for (let n = s.next; n <= day; n = advance({ ...s, next: n }))
        if (n === day) bal += s.kind === "income" ? s.amt : -s.amt;
    for (const due of dues)
      if (due.date === day && due.item.accountId === account?.id)
        bal += due.item.kind === "income" ? due.item.amount : -due.item.amount;
    pts.push(bal);
  }
  return pts;
}
