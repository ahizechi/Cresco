// Habits Today: a chosen day's check-ins, ongoing routines and rest days.
import { useState } from "react";
import {
  DOW,
  TODAY,
  addDays,
  daysText,
  dlong,
  dow,
  dshort,
  mondayOf,
  toD,
} from "../core/dates";
import { apply } from "../core/commands";
import { cx } from "../core/format";
import { S, openDialog, openSheet } from "../core/state";
import { Btn } from "../ui/controls";
import { Panel, Row } from "../ui/layout";
import { Ring } from "../ui/spark";
import { resume } from "./commands";
import { HabitRow } from "./HabitRow";
import { RoutineRow } from "./Routines";
import {
  dayFraction,
  dayGroups,
  dayHabits,
  dayInWeek,
  consistency,
  hdone,
  hsched,
  inPause,
  liveHabits,
  pauseText,
} from "./selectors";

function WeekStrip({
  wk,
  sel,
  onPick,
}: {
  wk: string;
  sel: string;
  onPick: (day: string) => void;
}) {
  return (
    <div className="hweek" role="group" aria-label="Choose a day">
      {Array.from({ length: 7 }, (_, i) => addDays(wk, i)).map((d) => {
        const f = dayFraction(d),
          fut = d > TODAY;
        const state = fut
          ? ", upcoming"
          : f == null
            ? ", nothing scheduled"
            : `, ${Math.round(f * 100)}% done`;
        return (
          <button
            type="button"
            key={d}
            className={cx("hday", d === TODAY && "today")}
            aria-pressed={d === sel ? "true" : "false"}
            disabled={fut}
            aria-label={dlong(d) + state}
            onClick={() => onPick(d)}
          >
            <span className="hday-dow">{DOW[dow(d)]}</span>
            <span className="hday-n">{toD(d).getDate()}</span>
            <Ring value={fut ? 0 : f || 0} size={20} stroke={3} />
          </button>
        );
      })}
    </div>
  );
}

export function HabitToday() {
  const [sel, setSel] = useState(TODAY);
  const [wk, setWk] = useState(mondayOf(TODAY));
  const hs = dayHabits(sel);
  const doneN = hs.filter((x) => hdone(x, sel)).length;
  const other = liveHabits().filter((x) => !hsched(x, sel));
  const tz = S.profile.tz.replace("_", " ");
  const moveWeek = (by: number) => {
    const w = addDays(wk, by);
    setWk(w);
    setSel(dayInWeek(w, sel));
  };
  return (
    <div className="g g-side">
      <Panel
        title={sel === TODAY ? "Today" : dlong(sel)}
        detail={
          sel === TODAY
            ? dlong(TODAY) + " · " + tz
            : "Correcting a past day recalculates streaks"
        }
        list
        isEmpty={hs.length === 0}
        empty={{
          icon: "sparkles",
          title: "No habits scheduled",
          text: "Habits you add appear here on the days they repeat.",
          action: (
            <Btn sm i="plus" onClick={() => openDialog("habit")}>
              New habit
            </Btn>
          ),
        }}
        actions={
          <>
            <Btn
              v="muted-ghost"
              sm
              icon
              i="chevron-left"
              aria-label="Previous week"
              onClick={() => moveWeek(-7)}
            />
            <Btn
              sm
              disabled={sel === TODAY}
              onClick={() => {
                setSel(TODAY);
                setWk(mondayOf(TODAY));
              }}
            >
              Today
            </Btn>
            <Btn
              v="muted-ghost"
              sm
              icon
              i="chevron-right"
              aria-label="Next week"
              disabled={addDays(wk, 7) > TODAY}
              onClick={() => moveWeek(7)}
            />
          </>
        }
      >
        <WeekStrip wk={wk} sel={sel} onPick={setSel} />
        <div className="hsum">
          <Ring
            value={hs.length ? doneN / hs.length : 0}
            size={44}
            stroke={5}
          />
          <div>
            <div className="strong">{`${doneN} of ${hs.length} done`}</div>
            <div className="meta">
              {sel === TODAY
                ? `The day stays open until midnight, ${tz}.`
                : "Earlier days keep the rules they had then."}
            </div>
          </div>
        </div>
        {dayGroups(sel).map(([g, list]) => (
          <div key={g}>
            <div className="section-label">{g}</div>
            <div className="rows">
              {list.map((x) => (
                <HabitRow key={x.id} hb={x} date={sel} />
              ))}
            </div>
          </div>
        ))}
        {!hs.length && (
          <div className="meta" style={{ padding: "16px 0" }}>
            Nothing scheduled on this day.
          </div>
        )}
      </Panel>
      <div className="stackc">
        <Panel
          title="Ongoing"
          detail="Counts until you pause or stop it"
          list
          isEmpty={S.routines.every((r) => r.status === "stopped")}
          empty={{
            icon: "timer",
            title: "Nothing ongoing",
            action: (
              <Btn sm i="plus" onClick={() => openDialog("routine")}>
                Start ongoing
              </Btn>
            ),
          }}
          actions={
            <>
              <Btn
                sm
                v="muted-ghost"
                i="history"
                onClick={() => openSheet("routineArchive")}
              >
                Stopped
              </Btn>
              <Btn
                v="muted-ghost"
                sm
                icon
                i="plus"
                aria-label="Start something ongoing"
                title="Start something ongoing"
                onClick={() => openDialog("routine")}
              />
            </>
          }
        >
          <div className="rows">
            {S.routines
              .filter((r) => r.status !== "stopped")
              .map((r) => (
                <RoutineRow key={r.id} r={r} compact />
              ))}
          </div>
        </Panel>
        <Panel
          title="28-day rates"
          detail="Scheduled days completed"
          cls={other.length ? "" : "fill"}
        >
          {liveHabits().length ? (
            <div className="rows">
              {liveHabits()
                .slice(0, 6)
                .map((habit) => (
                  <div className="row" key={habit.id}>
                    <span className="row-main">{habit.name}</span>
                    <strong>
                      {consistency(habit, 28) == null
                        ? "—"
                        : `${Math.round((consistency(habit, 28) ?? 0) * 100)}%`}
                    </strong>
                  </div>
                ))}
            </div>
          ) : (
            <p className="meta">No check-ins yet.</p>
          )}
        </Panel>
        {(S.habits.length > 0 || other.length > 0) && (
          <Panel
            cls="fill"
            title="Not scheduled"
            detail={
              sel === TODAY
                ? "Rest days and paused habits"
                : "On " + dshort(sel)
            }
            list
            isEmpty={other.length === 0}
            empty={{ icon: "calendar", title: "Nothing else" }}
          >
            <div className="rows">
              {other.length ? (
                other.map((x) => (
                  <Row
                    key={x.id}
                    icon={x.icon}
                    tone={x.status === "paused" ? undefined : x.tone}
                    title={x.name}
                    sub={
                      x.status === "paused" && inPause(x, sel)
                        ? pauseText(x)
                        : daysText(x.days)
                    }
                    end={
                      x.status === "paused" &&
                      sel === TODAY && (
                        <Btn
                          sm
                          onClick={() =>
                            void apply(
                              resume(x),
                              x.name + " resumed from today",
                            )
                          }
                        >
                          Resume
                        </Btn>
                      )
                    }
                  />
                ))
              ) : (
                <div className="row meta">
                  Every habit is scheduled on this day.
                </div>
              )}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
