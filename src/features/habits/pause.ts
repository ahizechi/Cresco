import { type Habit, addDays } from "./model";

export const PAUSE_UNTIL_RESUMED = "2099-12-31";

export function isPaused(habit: Habit, date: string): boolean {
  return habit.pauses.some((p) => date >= p.from && date <= p.to);
}

export function resumeHabit(habit: Habit, date: string): Habit {
  const newPauses: { from: string; to: string }[] = [];
  const endBefore = addDays(date, -1);

  for (const p of habit.pauses) {
    if (p.to < date) {
      newPauses.push(p);
    } else if (p.from > date) {
      newPauses.push(p);
    } else if (p.from < date) {
      newPauses.push({ from: p.from, to: endBefore });
    }
  }

  return {
    ...habit,
    pauses: newPauses,
  };
}
