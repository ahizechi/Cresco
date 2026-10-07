import { S, openDialog } from "../core/state";
import { Btn } from "../ui/controls";
import { PageHead } from "../ui/PageHeader";
import { HabitAll } from "./HabitAll";
import { HabitHistory } from "./HabitHistory";
import { HabitToday } from "./HabitToday";

export function HabitsPage() {
  const tab = S.route.tab;
  return (
    <div className="view">
      <PageHead
        sub="Measured progress, one day at a time"
        actions={
          <Btn v="primary" i="plus" onClick={() => openDialog("habit")}>
            New habit
          </Btn>
        }
      />
      {tab === "today" && <HabitToday />}
      {tab === "all" && <HabitAll />}
      {tab === "history" && <HabitHistory />}
    </div>
  );
}
