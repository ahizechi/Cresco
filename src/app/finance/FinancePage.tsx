import { TODAY } from "../core/dates";
import { monthText } from "../core/format";
import { S, openDialog } from "../core/state";
import { Btn } from "../ui/controls";
import { PageHead } from "../ui/PageHeader";
import { FinAccounts } from "./Accounts";
import { FinBills } from "./Bills";
import { FinBudgets, FinGoals } from "./Budgets";
import { FinOverview } from "./Overview";
import { FinTransactions } from "./Transactions";
import { unsureMerchants } from "./selectors";

export function FinancePage() {
  const tab = S.route.tab;
  const pending = unsureMerchants();
  const renew = S.banks.filter((b) => b.status === "renew").length;
  return (
    <div className="view">
      <PageHead
        sub={monthText(TODAY.slice(0, 7)) + " · GBP"}
        counts={{ transactions: pending, accounts: renew }}
        actions={
          <>
            <Btn i="upload" onClick={() => openDialog("import")}>
              Import statement
            </Btn>
            <Btn v="primary" i="plus" onClick={() => openDialog("txn")}>
              Add transaction
            </Btn>
          </>
        }
      />
      {tab === "overview" && <FinOverview />}
      {tab === "transactions" && <FinTransactions />}
      {tab === "budgets" && <FinBudgets />}
      {tab === "goals" && <FinGoals />}
      {tab === "bills" && <FinBills />}
      {tab === "accounts" && <FinAccounts />}
    </div>
  );
}
