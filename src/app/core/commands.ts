// Data changes. Each command says how it edits the illustrative sample view
// and how it writes the real stores through the domain functions. Real writes
// are awaited: success is reported only after the store saved, and a rejected
// save or a validation error reaches the user.
import { sampleMode } from "@sample";
import type { Dashboard } from "../../features/sections/useDashboard";
import { S, dashboard, toast, updateView } from "./state";
import type { ViewState } from "./view";

/** The result of one or more store writes. */
export interface Saved {
  ok: boolean;
  /** Puts back what the write changed, leaving later edits to other records. */
  undo?: () => Promise<boolean>;
}

/** Anything with a functional updater that resolves to whether it saved. */
export interface Writable<T> {
  update: (change: (value: T) => T) => Promise<boolean>;
}

/** Adapts a persisted section ({ value, set }) to the Writable shape. */
export const section = <T>(store: {
  set: (change: (value: T) => T) => Promise<boolean>;
}): Writable<T> => ({ update: (change) => store.set(change) });

/** Writes one store and records what changed, for Undo. */
export async function write<T>(
  store: Writable<T>,
  change: (value: T) => T,
): Promise<Saved> {
  let before: T | undefined;
  let after: T | undefined;
  const ok = await store.update((current) => {
    before = current;
    after = change(current);
    return after;
  });
  if (!ok || before === undefined || before === after) return { ok };
  const [was, now] = [before, after as T];
  return {
    ok,
    undo: () => store.update((current) => revert(was, now, current)),
  };
}

/** Combines writes to several stores; Undo reverts them in reverse order. */
export function together(...results: Saved[]): Saved {
  return {
    ok: results.every((result) => result.ok),
    undo: async () => {
      let ok = true;
      for (const result of [...results].reverse())
        if (result.undo) ok = (await result.undo()) && ok;
      return ok;
    },
  };
}

type Plain = Record<string, unknown>;
const isPlain = (value: unknown): value is Plain =>
  !!value &&
  typeof value === "object" &&
  Object.getPrototypeOf(value) === Object.prototype;
const hasIds = (value: unknown[]): value is { id: string }[] =>
  value.every((item) => isPlain(item) && typeof item.id === "string");

/**
 * Reverts the change from `before` to `after` inside `current`. Records are
 * compared by reference, so a record the change did not replace is kept as it
 * is now. Lists of records with ids revert per id; objects revert per key.
 */
export function revert<T>(before: T, after: T, current: T): T {
  if (before === after) return current;
  if (after === current) return before;
  if (
    Array.isArray(before) &&
    Array.isArray(after) &&
    Array.isArray(current) &&
    hasIds(before) &&
    hasIds(after) &&
    hasIds(current)
  ) {
    const was = new Map(before.map((item) => [item.id, item]));
    const now = new Map(after.map((item) => [item.id, item]));
    let result = [...current];
    for (const id of new Set([...was.keys(), ...now.keys()])) {
      const old = was.get(id);
      const changed = now.get(id);
      if (old === changed) continue;
      const at = result.findIndex((item) => item.id === id);
      if (!old) {
        if (at >= 0) result = result.filter((item) => item.id !== id);
      } else if (at >= 0) {
        result[at] = changed ? revert(old, changed, result[at]) : old;
      } else {
        result.splice(Math.min(before.indexOf(old), result.length), 0, old);
      }
    }
    return result as T;
  }
  if (isPlain(before) && isPlain(after) && isPlain(current)) {
    const result: Plain = { ...current };
    for (const key of new Set([
      ...Object.keys(before),
      ...Object.keys(after),
    ])) {
      if (before[key] === after[key]) continue;
      if (!Object.hasOwn(before, key)) delete result[key];
      else
        result[key] = Object.hasOwn(current, key)
          ? revert(before[key], after[key], current[key])
          : before[key];
    }
    return result as T;
  }
  return before;
}

export type Change = ViewChange | StoreChange;

/**
 * A change to a section whose sample data is itself an in-memory store
 * (Restock and Fitness), so both modes write through the store.
 */
export interface StoreChange {
  sample?: undefined;
  real: (stores: Dashboard) => Promise<Saved>;
  keys?: undefined;
}

export interface ViewChange {
  /** Sample mode: edits the illustrative view in memory. */
  sample: (view: ViewState) => void;
  /** Real mode: writes the stores. Throw an Error to reject invalid input. */
  real: (stores: Dashboard) => Promise<Saved>;
  /** View keys the sample edit touches, restored by Undo in sample mode. */
  keys?: (keyof ViewState)[];
}

export interface ApplyOptions {
  /** Offer Undo on the confirmation. */
  undo?: boolean;
}

export const SAVE_FAILED =
  "Changes could not be saved. Your previous data is still intact.";
const reason = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/**
 * Runs a change and resolves whether it took effect. `done` is shown only
 * after a successful save.
 */
export async function apply(
  change: Change,
  done?: string,
  options: ApplyOptions = {},
): Promise<boolean> {
  if (sampleMode && change.sample) {
    const sample = change.sample;
    const snapshot =
      options.undo && change.keys
        ? change.keys.map((key) => [key, structuredClone(S[key])] as const)
        : null;
    try {
      updateView(sample);
    } catch (error) {
      toast(reason(error), { error: true });
      return false;
    }
    if (done)
      toast(
        done,
        snapshot
          ? {
              undo: () => {
                updateView((view) => {
                  for (const [key, value] of snapshot)
                    Object.assign(view, { [key]: value });
                });
                toast("Undone");
              },
            }
          : {},
      );
    return true;
  }
  let saved: Saved;
  try {
    saved = await change.real(dashboard);
  } catch (error) {
    toast(`Changes could not be saved: ${reason(error)}`, { error: true });
    return false;
  }
  if (!saved.ok) {
    toast(SAVE_FAILED, { error: true });
    return false;
  }
  if (done) {
    const undo = saved.undo;
    toast(
      done,
      options.undo && undo
        ? {
            undo: () =>
              void undo()
                .then((ok) =>
                  ok ? toast("Undone") : toast(SAVE_FAILED, { error: true }),
                )
                .catch((error) =>
                  toast(`Could not undo: ${reason(error)}`, { error: true }),
                ),
          }
        : {},
    );
  }
  return true;
}
