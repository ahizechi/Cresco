import { useRevisionedData } from "../sections/useRevisionedData";
import { emptyFinance } from "./model";
import { loadFinance, saveFinance } from "./storage";
import { sampleFinance, sampleMode } from "@sample";

export function useFinance() {
  return useRevisionedData(
    emptyFinance(),
    loadFinance,
    saveFinance,
    sampleMode ? sampleFinance : null,
    "finance",
  );
}
