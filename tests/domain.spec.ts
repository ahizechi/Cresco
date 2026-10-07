import { test, expect } from "@playwright/test";
import {
  emptyFinance,
  validateFinance,
  balance,
} from "../src/features/finance/model";
import {
  emptyHabits,
  validateHabits,
  todayIn,
} from "../src/features/habits/model";
import {
  pauseAndDrain,
  resumeEditing,
  editingAllowed,
  trackWrite,
} from "../src/updates/writes";
import {
  validateRoutines,
  changeRoutine,
  type Routine,
} from "../src/features/sections/routines";
test("routine restart never silently drops retained history", () => {
  const row: Routine = {
    id: "r",
    title: "Synthetic",
    kind: "continuous",
    createdAt: "2026-10-07T12:00:00Z",
    status: "stopped",
    startedAt: null,
    elapsedMs: 1000,
    stoppedAt: "2026-10-07T12:01:00Z",
    checks: [],
    history: Array.from({ length: 100 }, () => ({
      endedAt: "2026-10-07T12:01:00Z",
      elapsedMs: 1000,
    })),
  };
  expect(() =>
    changeRoutine(row, "restart", Date.parse("2026-10-07T12:02:00Z")),
  ).toThrow("history is full");
  expect(row.history).toHaveLength(100);
  const earlier = { ...row, history: row.history.slice(0, 99) };
  expect(
    changeRoutine(earlier, "restart", Date.parse("2026-10-07T12:02:00Z"))
      .history,
  ).toHaveLength(100);
});
test("routine restores reject duplicate IDs, unsafe elapsed values and invalid timestamps", () => {
  const row = {
    id: "synthetic",
    title: "Synthetic routine",
    kind: "continuous",
    createdAt: "2026-10-07T12:00:00Z",
    status: "paused",
    startedAt: null,
    elapsedMs: 1000,
    checks: [],
    history: [],
  };
  expect(validateRoutines({ routines: [row] }).routines).toHaveLength(1);
  expect(() => validateRoutines({ routines: [row, row] })).toThrow();
  for (const elapsedMs of [1.5, -1, Number.MAX_SAFE_INTEGER + 1])
    expect(() =>
      validateRoutines({ routines: [{ ...row, elapsedMs }] }),
    ).toThrow();
  expect(() =>
    validateRoutines({ routines: [{ ...row, createdAt: "not a timestamp" }] }),
  ).toThrow();
  expect(() =>
    validateRoutines({
      routines: [{ ...row, createdAt: "2026-02-31T12:00:00Z" }],
    }),
  ).toThrow();
  expect(() =>
    validateRoutines({ routines: [{ ...row, title: "x".repeat(501) }] }),
  ).toThrow();
});
test("money never guesses exchange rates or drops malformed data", () => {
  const data = emptyFinance();
  data.accounts.push({
    id: "a",
    name: "Synthetic",
    bank: "",
    kind: "current",
    currency: "GBP",
    openingBalance: 10000,
    openingDate: "2026-01-01",
    archived: false,
  });
  data.transactions.push({
    id: "t",
    accountId: "a",
    date: "2026-01-02",
    description: "Synthetic purchase",
    amount: -1234,
    category: "Groceries",
    kind: "expense",
    status: "posted",
    note: "",
    source: "manual",
  });
  expect(balance(validateFinance(data), data.accounts[0])).toBe(8766);
  expect(() =>
    validateFinance({
      ...data,
      transactions: [{ ...data.transactions[0], amount: 12.34 }],
    }),
  ).toThrow();
  expect(() =>
    validateFinance({
      ...data,
      transactions: [{ ...data.transactions[0], accountId: "missing" }],
    }),
  ).toThrow();
});
test("habit validation and configured timezone boundary", () => {
  expect(validateHabits(emptyHabits()).habits).toEqual([]);
  expect(todayIn("Asia/Tokyo", new Date("2026-10-07T23:30:00Z"))).toBe(
    "2026-10-08",
  );
  expect(todayIn("America/Los_Angeles", new Date("2026-10-07T00:30:00Z"))).toBe(
    "2026-10-06",
  );
  expect(() =>
    validateHabits({ ...emptyHabits(), timezone: "bad/zone" }),
  ).toThrow();
});
test("updater drains accepted saves and rejects new edits until resumed", async () => {
  let resolve!: (ok: boolean) => void;
  const write = trackWrite(
    new Promise<boolean>((done) => {
      resolve = done;
    }),
  );
  let drained = false;
  const pause = pauseAndDrain().then(() => {
    drained = true;
  });
  expect(editingAllowed()).toBe(false);
  await Promise.resolve();
  expect(drained).toBe(false);
  resolve(true);
  await write;
  await pause;
  expect(drained).toBe(true);
  resumeEditing();
  expect(editingAllowed()).toBe(true);
});
test("failed save aborts updater and unlocks editing", async () => {
  let resolve!: (ok: boolean) => void;
  trackWrite(
    new Promise<boolean>((done) => {
      resolve = done;
    }),
  );
  const pause = pauseAndDrain();
  resolve(false);
  await expect(pause).rejects.toThrow("A save failed");
  expect(editingAllowed()).toBe(true);
});
