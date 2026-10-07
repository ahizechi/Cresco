import { MON, dshort, toD } from "../core/dates";
import { money } from "../core/format";
import { S, go, openDialog } from "../core/state";
import { Bar, Btn, Status, Tile } from "../ui/controls";
import { Panel } from "../ui/layout";
import { Amount, CatChip } from "./rows";
import { CATS, acct } from "./selectors";

/** Recent transactions and goals on the Finance overview. */
export function OverviewLists() {
  const recent = [...S.txns]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  return (
    <div className="g g-main">
      <Panel
        flush
        title="Recent transactions"
        detail="Latest across your accounts"
        list
        isEmpty={recent.length === 0}
        empty={{ icon: "receipt-text", title: "No transactions yet" }}
        actions={
          <Btn v="muted-ghost" sm onClick={() => go("finance", "transactions")}>
            View all
          </Btn>
        }
      >
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th className="num">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((t) => (
                <tr
                  key={t.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => openDialog("txn", { t })}
                >
                  <td className="muted">{dshort(t.date)}</td>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        alignItems: "center",
                      }}
                    >
                      <Tile
                        i={
                          t.transfer
                            ? "arrow-left-right"
                            : CATS[t.cat]?.i || "circle-dashed"
                        }
                        sm
                        plain
                      />
                      <div>
                        <div>{t.merchant}</div>
                        <div className="row-sub">{acct(t.acct)?.inst}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <CatChip c={t.cat} />
                  </td>
                  <td className="num">
                    <Amount t={t} />
                  </td>
                  <td>
                    <Status s={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel
        title="Goals"
        detail={`${S.goals.length} goals · saved by you`}
        list
        isEmpty={S.goals.length === 0}
        empty={{
          icon: "target",
          title: "No goals yet",
          action: (
            <Btn sm i="plus" onClick={() => openDialog("goal")}>
              New goal
            </Btn>
          ),
        }}
        actions={
          <Btn v="muted-ghost" sm onClick={() => go("finance", "budgets")}>
            View all
          </Btn>
        }
      >
        <div className="rows">
          {S.goals.map((g) => (
            <div className="goal" key={g.id}>
              <Tile i={g.icon} tone={g.tone} sm />
              <div className="goal-top">
                <span>{g.name}</span>
                <span className="num muted">
                  {Math.round((g.saved / g.target) * 100)}%
                </span>
              </div>
              <Bar
                value={g.saved}
                max={g.target}
                tone={g.tone}
                label={g.name + " progress"}
              />
              <div className="row-sub num">
                {`${money(g.saved, { whole: true })} of ${money(g.target, { whole: true })} · by ${MON[toD(g.by).getMonth()]} ${toD(g.by).getFullYear()}`}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
