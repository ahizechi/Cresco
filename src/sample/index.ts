// No bundled personal or illustrative records. Browser tests supply synthetic fixtures.
import empty from "../app/empty-view.json";
export const sampleMode = false;
export const sampleSeed = empty;
export const SAMPLE_DAY = "2026-01-01";
export const sampleFinance = null;
export const sampleHabits = null;
export const sampleRoutineHistory = (_id?: boolean) => [];
export function sampleValue<T>(_section: string, seed: T): T {
  return seed;
}
export function rememberSample(_section: string, _value: unknown) {}
