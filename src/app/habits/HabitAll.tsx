// All habits: the searchable table, the archive and how streaks work.
import { useState } from "react";
import { dayN, daysText } from "../core/dates";
import { apply } from "../core/commands";
import { num } from "../core/format";
import { S, closeSheet, openDialog, openSheet } from "../core/state";
import type { HabitRow, MenuItem } from "../core/view";
import { Bar, Btn, I, Status, Tile } from "../ui/controls";
import { Panel, Row, RowMenu, Sheet } from "../ui/layout";
import { resume, setArchived } from "./commands";
import {
  bestStreak,
  consistency,
  liveHabits,
  measured,
  pauseText,
  streak,
  totalDone,
} from "./selectors";

const habitActions = (x: HabitRow): MenuItem[] => [
  { l: "Edit…", i: "pencil", f: () => openDialog("habit", { hb: x }) },
  x.status === "active"
    ? { l: "Pause…", i: "pause", f: () => openDialog("habitPause", { hb: x }) }
    : {
        l: "Resume from today",
        i: "play",
        f: () => void apply(resume(x), x.name + " resumed from today"),
      },
  {
    l: "Archive",
    i: "archive",
    f: () =>
      void apply(setArchived(x, true), x.name + " archived · history kept", {
        undo: true,
      }),
  },
];

function HabitLine({ x }: { x: HabitRow }) {
  const c = consistency(x);
  return (
    <tr>
      <td>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Tile i={x.icon} tone={x.tone} sm />
          <div>
            <div>{x.name}</div>
            {x.cat && <div className="row-sub">{x.cat}</div>}
          </div>
        </div>
      </td>
      <td>
        <div>{daysText(x.days)}</div>
        <div className="row-sub">{x.tod || "Anytime"}</div>
      </td>
      <td className="num">
        {measured(x)
          ? num(x.target) + (x.unit ? " " + x.unit : "")
          : "Check off"}
      </td>
      <td className="num">
        <div>{dayN(streak(x))}</div>
        <div className="row-sub">{"Best " + dayN(bestStreak(x))}</div>
      </td>
      <td>
        <div className="cons">
          <Bar value={c || 0} max={1} tone={x.tone} />
          <span className="num">
            {c == null ? "—" : Math.round(c * 100) + "%"}
          </span>
        </div>
      </td>
      <td>
        <Status s={x.status} />
        {x.status === "paused" && <div className="row-sub">{pauseText(x)}</div>}
      </td>
      <td className="w-act">
        <RowMenu label={"Actions for " + x.name} items={habitActions(x)} />
      </td>
    </tr>
  );
}

export function HabitAll() {
  const [q, setQ] = useState("");
  const all = liveHabits();
  const needle = q.trim().toLowerCase();
  const list = all.filter((x) =>
    (x.name + " " + (x.cat || "")).toLowerCase().includes(needle),
  );
  const arch = S.habits.filter((x) => x.status === "archived");
  return (
    <div className="view">
      <Panel
        flush
        list
        isEmpty={all.length === 0}
        empty={{
          icon: "sparkles",
          title: "No habits yet",
          action: (
            <Btn sm i="plus" onClick={() => openDialog("habit")}>
              New habit
            </Btn>
          ),
        }}
      >
        <div className="toolbar" style={{ padding: "16px 20px 12px" }}>
          <div className="input-icon" style={{ flex: "1", maxWidth: "300px" }}>
            <I n="search" />
            <input
              className="input"
              id="hb-search"
              placeholder="Search by name or category"
              value={q}
              onInput={(e) => setQ(e.currentTarget.value)}
              aria-label="Search habits"
            />
          </div>
          <span className="grow" />
          <span className="meta">{`${all.length} habits`}</span>
          <Btn
            sm
            v="muted-ghost"
            i="info"
            onClick={() => openSheet("streakRules")}
          >
            How streaks work
          </Btn>
        </div>
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Habit</th>
                <th>Repeats</th>
                <th className="num">Target</th>
                <th className="num">Streak</th>
                <th>Last 28 days</th>
                <th>Status</th>
                <th className="w-act">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((x) => (
                <HabitLine key={x.id} x={x} />
              ))}
            </tbody>
          </table>
        </div>
        {!list.length && (
          <div className="meta" style={{ padding: "16px 20px" }}>
            {q
              ? `No habits match “${q}”.`
              : "No habits yet. Create your first habit."}
          </div>
        )}
      </Panel>
      {arch.length > 0 && (
        <Panel
          title="Archived"
          detail="Archived habits aren't scheduled. Their check-ins stay in History."
        >
          <div className="rows">
            {arch.map((x) => (
              <Row
                key={x.id}
                icon={x.icon}
                title={x.name}
                sub={`${totalDone(x)} completions · ${x.cat || "No category"}`}
                end={
                  <Btn
                    sm
                    i="archive-restore"
                    onClick={() =>
                      void apply(
                        setArchived(x, false),
                        x.name + " restored from today",
                      )
                    }
                  >
                    Restore
                  </Btn>
                }
              />
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

export function StreakRulesSheet() {
  return (
    <Sheet
      title="How streaks work"
      desc="The same rules apply to every habit."
      foot={<Btn onClick={closeSheet}>Close</Btn>}
    >
      <ul className="rules">
        <li>
          A completed scheduled day adds one to the streak. Completing twice
          still counts once.
        </li>
        <li>
          An unfinished or partly done day breaks the streak once it closes at
          midnight. Today stays open.
        </li>
        <li>
          A skip counts as scheduled but not completed, so it breaks the streak
          straight away.
        </li>
        <li>
          Rest days and paused days neither add to nor break a streak. Progress
          logged before a pause stays.
        </li>
        <li>
          Schedule, target and unit changes apply from today. Earlier days keep
          their original rules.
        </li>
        <li>
          Correcting a past day or changing a pause recalculates streaks. There
          are no streak freezes.
        </li>
      </ul>
    </Sheet>
  );
}
