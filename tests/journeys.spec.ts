import { test, expect } from "@playwright/test";
test("empty app, habit creation/check/undo and persistence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Habits", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "New habit", exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "New habit", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "New habit" });
  await dialog.getByLabel("Name", { exact: true }).fill("Read a chapter");
  await dialog.getByRole("button", { name: "Check off", exact: true }).click();
  await dialog.getByRole("button", { name: "Create habit" }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByText("Read a chapter", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Complete: Read a chapter" })
    .check();
  await expect(
    page.getByRole("checkbox", { name: "Mark not done: Read a chapter" }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "Complete: Read a chapter" }),
  ).not.toBeChecked();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("cresco-habits-preview-v1")!).entries
            .length,
      ),
    )
    .toBe(0);
  await page.reload();
  await expect(
    page.getByText("Read a chapter", { exact: true }).first(),
  ).toBeVisible();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cresco-habits-preview-v1")!),
  );
  expect(stored.habits).toHaveLength(1);
  expect(stored.entries).toHaveLength(0);
  expect(errors).toEqual([]);
});
test("accounts, transactions and integer balance persist", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Money", exact: true }).click();
  await page.getByRole("tab", { name: "Accounts", exact: true }).click();
  await page.getByRole("button", { name: "Add account", exact: true }).click();
  const account = page.getByRole("dialog");
  await account
    .getByLabel("Name", { exact: true })
    .fill("Test current account");
  await account.getByRole("button", { name: "Save", exact: true }).click();
  await expect(account).toBeHidden();
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  const txn = page.getByRole("dialog", { name: "Add transaction" });
  await txn.getByLabel("Paid to or from").fill("Test groceries");
  await txn.getByLabel("Amount", { exact: true }).fill("12.34");
  await txn
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await expect(txn).toBeHidden();
  await page.getByRole("tab", { name: "Transactions", exact: true }).click();
  await expect(page.getByText("Test groceries", { exact: true })).toBeVisible();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cresco-finance-preview-v1")!),
  );
  expect(stored.accounts).toHaveLength(1);
  expect(stored.transactions).toHaveLength(1);
  expect(Math.abs(stored.transactions[0].amount)).toBe(1234);
  await page.reload();
  await expect(page.getByText("Test groceries", { exact: true })).toBeVisible();
});
test("keyboard tabs, dialog focus, motion and visible routes", async ({
  page,
}) => {
  await page.goto("/");
  const tab = page.getByRole("tab", { name: "Today", exact: true });
  await tab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "All habits", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "New habit", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "New habit", exact: true }).first(),
  ).toBeFocused();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByText("Updates are available in the installed Windows app."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Check for updates" }),
  ).toBeDisabled();
  await expect(page.locator("nav button")).toHaveCount(3);
});
test("unreadable finance preserved until reviewed recovery", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "cresco-finance-preview-v1",
      "corrupt synthetic fixture",
    ),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Money", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your data needs recovery" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("cresco-finance-preview-v1"),
    ),
  ).toBe("corrupt synthetic fixture");
  await expect(
    page.getByRole("button", { name: "Add transaction", exact: true }),
  ).toHaveCount(0);
});
test("mobile geometry, light/dark and reduced motion screenshots", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Habits", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("habits-mobile-dark.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.getByRole("button", { name: "Money", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Money", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("money-desktop-light.png"),
    fullPage: true,
    animations: "disabled",
  });
});

test("CSV import is reviewed, deduplicated and undoable", async ({ page }) => {
  const finance = {
    schema: 1,
    revision: 0,
    accounts: [
      {
        id: "a",
        name: "Synthetic account",
        bank: "",
        kind: "current",
        currency: "GBP",
        openingBalance: 10000,
        openingDate: "2026-01-01",
        archived: false,
      },
    ],
    transactions: [],
    budgets: [],
    recurring: [],
    assets: [],
    goals: [],
    rules: [],
    imports: [],
    snapshots: [],
  };
  await page.addInitScript(
    (value) =>
      localStorage.setItem("cresco-finance-preview-v1", JSON.stringify(value)),
    finance,
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Money", exact: true }).click();
  await page.getByRole("button", { name: "Import statement" }).click();
  const dialog = page.getByRole("dialog", { name: "Import a statement" });
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  await dialog.locator("input[type=file]").setInputFiles({
    name: "synthetic.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Date,Description,Amount\n" +
        date +
        ",Synthetic cafe,-4.50\n" +
        date +
        ",Synthetic salary,25.00\n",
    ),
  });
  await expect(
    dialog.getByRole("button", { name: "Review rows" }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("cresco-finance-preview-v1")!)
          .transactions.length,
    ),
  ).toBe(0);
  await dialog.getByRole("button", { name: "Review rows" }).click();
  await dialog.getByRole("button", { name: "Import 2 transactions" }).click();
  await expect(dialog).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("cresco-finance-preview-v1")!)
            .transactions.length,
      ),
    )
    .toBe(2);
  await page.getByRole("button", { name: "Import statement" }).click();
  const duplicate = page.getByRole("dialog", { name: "Import a statement" });
  await duplicate.locator("input[type=file]").setInputFiles({
    name: "synthetic.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Date,Description,Amount\n" +
        date +
        ",Synthetic cafe,-4.50\n" +
        date +
        ",Synthetic salary,25.00\n",
    ),
  });
  await expect(duplicate.getByText(/2 already saved/)).toBeVisible();
  await duplicate.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("tab", { name: "Transactions", exact: true }).click();
  await page.getByRole("button", { name: "Undo import", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Undo import?" })
    .getByRole("button", { name: "Undo import", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("cresco-finance-preview-v1")!)
            .transactions.length,
      ),
    )
    .toBe(0);
});

test("routines backup validates object order and rejects lost fields", async () => {
  const { routineBackup } =
    await import("../src/features/sections/routines-storage");
  const row = {
    id: "r",
    title: "Synthetic routine",
    kind: "daily",
    createdAt: "2026-01-01T00:00:00Z",
    status: "running",
    startedAt: "2026-01-01T00:00:00Z",
    elapsedMs: 0,
    checks: [],
    history: [],
  };
  const unordered = Object.fromEntries(Object.entries(row).reverse());
  expect(
    routineBackup({
      kind: "cresco-routines/1",
      revision: 1,
      data: { routines: [unordered] },
    }).data.routines,
  ).toHaveLength(1);
  expect(() =>
    routineBackup({
      kind: "cresco-routines/1",
      revision: 1,
      data: {
        routines: [{ ...row, history: [{ elapsedMs: -1, endedAt: "bad" }] }],
      },
    }),
  ).toThrow();
});
