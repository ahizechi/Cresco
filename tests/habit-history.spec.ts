import { test, expect, type Page } from "@playwright/test";
import type { HabitData } from "../src/features/habits/model";

const today = "2026-10-17";
const day = (offset: number) => {
  const date = new Date(today + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};
function savedHistory(): HabitData {
  return {
    schema: 1,
    revision: 12,
    timezone: "Europe/London",
    habits: [
      {
        id: "reading",
        name: "Synthetic reading",
        description: "Keep the original history",
        category: "Daily",
        period: "Anytime",
        color: "blue",
        rules: [
          {
            from: day(-7),
            days: [0, 1, 2, 3, 4, 5, 6],
            kind: "count",
            target: 5,
            unit: "pages",
            enabled: true,
          },
          {
            from: day(-3),
            days: [0, 1, 2, 3, 4, 5, 6],
            kind: "count",
            target: 10,
            unit: "pages",
            enabled: true,
          },
        ],
        pauses: [],
      },
    ],
    entries: Array.from({ length: 5 }, (_, index) => ({
      habitId: "reading",
      date: day(index - 7),
      value: index === 4 ? 10 : 5,
      skipped: false,
      note: index === 0 ? "Original note" : "",
    })),
  };
}
async function openSaved(page: Page, data: HabitData) {
  await page.clock.setFixedTime(new Date(today + "T12:00:00Z"));
  await page.addInitScript(
    (value) =>
      localStorage.setItem("cresco-habits-preview-v1", JSON.stringify(value)),
    data,
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Export habits backup", exact: true }),
  ).toBeEnabled();
}

test("every offered time zone can be stored without changing records", async ({
  page,
}) => {
  const data = savedHistory();
  await openSaved(page, data);
  const zone = page.getByRole("combobox", { name: "Habit time zone" });
  const options = await zone
    .locator("option")
    .evaluateAll((rows) => rows.map((row) => (row as HTMLOptionElement).value));
  for (const timezone of options) {
    await zone.selectOption(timezone);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("cresco-habits-preview-v1")!)
              .timezone,
        ),
      )
      .toBe(timezone);
  }
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cresco-habits-preview-v1")!),
  );
  expect(saved.habits).toEqual(data.habits);
  expect(saved.entries).toEqual(data.entries);
});

test("old check-ins keep their targets, heat levels and streak after a target change", async ({
  page,
}) => {
  const data = savedHistory();
  await openSaved(page, data);
  await page.getByRole("button", { name: "Habits", exact: true }).click();
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Habit", exact: true })
    .selectOption("reading");
  await expect(
    page.getByText("5 of 7 scheduled check-ins", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("best 5", { exact: true })).toBeVisible();
  const heat = page.getByRole("button", {
    name: "Sat 10 Oct: 5 of 5 pages",
    exact: true,
  });
  await expect(heat).toContainText("100%");
  await heat.click();
  await expect(page.getByText("1 of 1 done", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mark missed", exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cresco-habits-preview-v1")!),
  );
  expect(saved).toEqual(data);
});

test("archiving and changing weekdays keep earlier check-ins visible", async ({
  page,
}) => {
  const data = savedHistory();
  data.habits[0].rules.push({
    ...data.habits[0].rules[1],
    from: today,
    days: [0],
    enabled: false,
  });
  await openSaved(page, data);
  await page.getByRole("button", { name: "Habits", exact: true }).click();
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await expect(
    page.getByText("5 of 7 scheduled check-ins", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sat 10 Oct: 100% done", exact: true })
    .click();
  await expect(page.getByText("1 of 1 done", { exact: true })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Habit", exact: true })
    .selectOption("reading");
  await expect(
    page.getByRole("button", { name: "Sat 10 Oct: 5 of 5 pages", exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cresco-habits-preview-v1")!),
  );
  expect(saved).toEqual(data);
});

test("correcting an earlier day uses its saved target and keeps other records", async ({
  page,
}) => {
  const data = savedHistory();
  data.entries[0].value = 1;
  await openSaved(page, data);
  await page.getByRole("button", { name: "Habits", exact: true }).click();
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Habit", exact: true })
    .selectOption("reading");
  await page
    .getByRole("button", { name: "Sat 10 Oct: 1 of 5 pages", exact: true })
    .click();
  await page.getByRole("button", { name: "Mark done", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("cresco-habits-preview-v1")!)
            .revision,
      ),
    )
    .toBe(13);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cresco-habits-preview-v1")!),
  );
  const expected = structuredClone(data);
  expected.revision = 13;
  expected.entries[0].value = 5;
  saved.entries.sort((a: { date: string }, b: { date: string }) =>
    a.date.localeCompare(b.date),
  );
  expected.entries.sort((a, b) => a.date.localeCompare(b.date));
  expect(saved).toEqual(expected);
});
