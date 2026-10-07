import { useFinance } from "../finance/useFinance";
import { useHabits } from "../habits/useHabits";
import { usePersistedSection } from "./usePersistedSection";
import { initialRoutines, validateRoutines } from "./routines";
export function useDashboard() {
  const finance = useFinance();
  const habits = useHabits();
  const [value, set, ready, error] = usePersistedSection(
    "routines",
    initialRoutines,
    validateRoutines,
  );
  return { finance, habits, routines: { value, set, ready, error } };
}
export type Dashboard = ReturnType<typeof useDashboard>;
