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
