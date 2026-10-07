import { useRevisionedData } from "../sections/useRevisionedData";
import { emptyHabits } from "./model";
import { loadHabits, saveHabits } from "./storage";
import { sampleHabits, sampleMode } from "@sample";

export function useHabits() {
  return useRevisionedData(
    emptyHabits(),
    loadHabits,
    saveHabits,
    sampleMode ? sampleHabits : null,
    "habits",
  );
}
