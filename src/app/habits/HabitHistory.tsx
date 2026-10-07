// Habits History: completion over closed days, and one day's check-ins.
import { useState } from "react";
import {
  DOW_MON,
  TODAY,
  addDays,
  dayN,
  dlong,
  dshort,
  toD,
} from "../core/dates";
import { vars } from "../core/dom";
import { cx, num } from "../core/format";
import { S } from "../core/state";
import { Btn, I, Seg, Sel, Tile } from "../ui/controls";
import { apply } from "../core/commands";
import { clearDay, setValue } from "./commands";
import { Panel, RowMenu, Stat } from "../ui/layout";
import { habitMenu } from "./HabitRow";
import {
  dayStatus,
  hdone,
  hkey,
  hrec,
  hsched,
  hskip,
  history,
  streak,
  bestStreak,
  type HeatCell,
} from "./selectors";

const WINDOWS = [
  { v: "28", l: "28 days" },
  { v: "90", l: "90 days" },
  { v: "365", l: "365 days" },
] as const;
type Win = (typeof WINDOWS)[number]["v"];

function Heat({
  cells,
  win,
  start,
  sel,
  tone,
  onPick,
}: {
  cells: HeatCell[];
  win: number;
  start: string;
  sel: string;
  tone: string;
  onPick: (day: string) => void;
}) {
  if (win === 28)
    return (
      <div
        className={"heat-cal tone-" + tone}
        role="group"
        aria-label="Daily completion"
      >
        {DOW_MON.map((l) => (
          <span className="heat-dow" key={l} aria-hidden="true">
            {l}
          </span>
        ))}
        {cells.map((c) =>
          c.blank ? (
            <span
              className={c.d >= TODAY ? "heat-future" : "heat-leading"}
              key={c.d}
            >
              {c.d === TODAY ? (
                <>
                  <b>{toD(c.d).getDate()} · Today</b>
                  <small>Still open</small>
                </>
              ) : c.d > TODAY ? (
                toD(c.d).getDate() === 1 ? (
                  dshort(c.d)
                ) : (
                  toD(c.d).getDate()
                )
              ) : (
                ""
              )}
            </span>
          ) : (
            <button
              type="button"
              key={c.d}
              className={`${c.lv}${(c.pct ?? 0) >= 50 ? " heat-strong" : ""}`}
              style={vars({ "--fill": `${c.pct ?? 0}%` })}
              aria-pressed={c.d === sel ? "true" : "false"}
              aria-label={c.label}
              title={c.label}
              onClick={() => onPick(c.d)}
            >
              <span>
                {c.d === start || toD(c.d).getDate() === 1
                  ? dshort(c.d)
                  : toD(c.d).getDate()}
              </span>
              <small>{c.pct == null ? "—" : `${c.pct}%`}</small>
            </button>
          ),
        )}
      </div>
    );
  return (
    <div
      className={"heat-wrap tone-" + tone}
      style={vars({ "--cell": (win === 90 ? 22 : 11) + "px" })}
    >
      <div className="heat-days">
        {["Mon", "", "Wed", "", "Fri", "", "Sun"].map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
      <div className="heat" role="group" aria-label="Daily completion">
        {cells.map((c) =>
          c.blank ? (
            <i key={c.d} className="blank" />
          ) : (
            <button
              type="button"
              key={c.d}
              className={c.lv}
              aria-pressed={c.d === sel ? "true" : "false"}
              aria-label={c.label}
              title={c.label}
              onClick={() => onPick(c.d)}
            />
          ),
        )}
      </div>
    </div>
  );
}

export function HabitHistory() {
  const [winText, setWin] = useState<Win>("28");
  const [hid, setHid] = useState("all");
  const [sel, setSel] = useState(addDays(TODAY, -1));
  const win = Number(winText);
  const { start, end, pool, one, due, done, skipped, best, cells } = history(
    win,
    hid,
  );
  const selHabits = pool.filter((x) => hsched(x, sel) || hrec(x, sel));
  const tone = one ? one.tone : "green";
  return (
    <div className="view">
      <div className="toolbar">
        <Seg
          value={winText}
          onChange={(v) => {
            setWin(v);
            if (sel < addDays(TODAY, -Number(v))) setSel(end);
          }}
          options={WINDOWS}
          label="Window"
        />
        <Sel
          cls="w-auto"
          value={hid}
          onChange={setHid}
          label="Habit"
          options={[
            { v: "all", l: "All habits" },
            ...S.habits.map((x) => ({
              v: x.id,
              l: x.name + (x.status === "archived" ? " (archived)" : ""),
            })),
          ]}
        />
        <span className="grow" />
        <span className="meta">Closed days only. Today is still open.</span>
      </div>
      <div className="g g-4">
        <Stat
          label="Completion rate"
          value={due ? Math.round((done / due) * 100) + "%" : "—"}
          note={`${num(done)} of ${num(due)} scheduled check-ins`}
        />
        <Stat
          label="Check-ins completed"
          value={num(done)}
          note={`Last ${win} closed days`}
        />
        <Stat
          label="Skipped"
          value={num(skipped)}
          note="Counted as not completed"
        />
        <Stat
          label="Best streak"
          value={best ? dayN(best[1]) : "—"}
          note={best ? (one ? "All time" : best[0].name + " · all time") : ""}
        />
      </div>
      <div className="g g-side">
        <Panel
          title="Daily completion"
          cls="habit-history-main"
          detail={
            one
              ? `${one.name}: how much of the target was done each scheduled day. Select a day to see or correct it.`
              : "Share of scheduled habits completed each day. Select a day to see or correct it."
          }
          list
          isEmpty={S.habits.length === 0}
          empty={{ icon: "history", title: "No check-ins yet" }}
        >
          <Heat
            cells={cells}
            win={win}
            start={start}
            sel={sel}
            tone={tone}
            onPick={setSel}
          />
          <div className="legend" style={{ marginTop: "6px" }}>
            <span>Less</span>
            <span
              className={"tone-" + tone}
              style={{ gap: "3px", display: "inline-flex" }}
            >
              {["", "l1", "l2", "l3"].map((l) => (
                <span
                  key={l}
                  className="heat"
                  style={{ display: "inline-grid", gridTemplateRows: "12px" }}
                >
                  <i className={l} />
                </span>
              ))}
            </span>
            <span>More</span>
          </div>
        </Panel>
        <div className="stackc">
          <Panel
            title={dlong(sel)}
            detail={
              selHabits.length
                ? `${selHabits.filter((x) => hdone(x, sel)).length} of ${selHabits.length} done`
                : "Nothing scheduled"
            }
            list
            isEmpty={selHabits.length === 0}
            empty={{ icon: "history", title: "No check-ins yet" }}
          >
            <div className="rows">
              {selHabits.map((x) => {
                const [text, level] = dayStatus(x, sel);
                const note =
                  S.hnote[hkey(x.id, sel)] ||
                  (level === "skip" ? hskip(x, sel) : "");
                return (
                  <div className="row" key={x.id}>
                    <Tile i={x.icon} tone={x.tone} sm />
                    <div className="row-main">
                      <div>{x.name}</div>
                      <div className={cx("row-sub", level === "miss" && "neg")}>
                        {note ? `${text} · ${note}` : text}
                      </div>
                    </div>
                    {sel < TODAY && hsched(x, sel) && (
                      <Btn
                        sm
                        onClick={() =>
                          void (hdone(x, sel)
                            ? apply(
                                clearDay(x, sel),
                                `${x.name} marked missed`,
                                {
                                  undo: true,
                                },
                              )
                            : apply(
                                setValue(x, sel, x.target),
                                `${x.name} marked done`,
                                { undo: true },
                              ))
                        }
                      >
                        {hdone(x, sel) ? "Mark missed" : "Mark done"}
                      </Btn>
                    )}
                    <RowMenu
                      label={"More actions for " + x.name}
                      items={habitMenu(x, sel)}
                    />
                  </div>
                );
              })}
              {!selHabits.length && (
                <div className="row meta">
                  No habits were scheduled on this day.
                </div>
              )}
            </div>
          </Panel>
          <Panel title="Streaks" detail="Current and best, all time" cls="fill">
            {pool.length ? (
              <div className="rows">
                {pool.map((habit) => (
                  <div className="row streak-row" key={habit.id}>
                    <span className="row-main">{habit.name}</span>
                    <span className="meta">best {bestStreak(habit)}</span>
                    <span
                      className="streak-now"
                      aria-label={`${streak(habit)} day current streak`}
                    >
                      <I n="flame" s={13} />
                      {streak(habit)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="meta">No streaks yet.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
