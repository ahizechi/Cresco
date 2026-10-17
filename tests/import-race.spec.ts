import { test, expect } from "@playwright/test";
import fs from "node:fs";

test("changing import accounts discards an earlier file read", async ({
  page,
}) => {
  const fixture = JSON.parse(
    fs.readFileSync("tests/fixtures/contracts/upgrade-0.1.4.json", "utf8"),
  );
  fixture.finance.transactions = [];
  fixture.finance.imports = [];
  await page.addInitScript((finance) => {
    localStorage.setItem("cresco-finance-preview-v1", JSON.stringify(finance));
    const text = File.prototype.text;
    File.prototype.text = function () {
      if (this.name !== "slow.csv") return text.call(this);
      const file = this;
      return new Promise<string>((resolve) => {
        (window as unknown as { finishRead: () => Promise<void> }).finishRead =
          async () => {
            resolve(await text.call(file));
          };
      });
    };
  }, fixture.finance);
  await page.goto("/");
  await page.getByRole("button", { name: "Money", exact: true }).click();
  await page
    .getByRole("button", { name: "Import statement", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Import a statement" });
  const picker = dialog.getByLabel("CSV statement");
  await picker.setInputFiles({
    name: "slow.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Date,Description,Amount\n2026-09-03,Old delayed purchase,-12.34\n",
    ),
  });
  await expect(
    dialog.getByText("Reading statement…", { exact: true }),
  ).toBeVisible();
  await dialog
    .getByLabel("Import into", { exact: true })
    .selectOption("savings");
  await picker.setInputFiles({
    name: "current.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Date,Description,Amount\n2026-09-03,Current purchase,-34.56\n",
    ),
  });
  await expect(dialog.getByText(/current\.csv/)).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { finishRead: () => Promise<void> }).finishRead(),
  );
  await dialog
    .getByRole("button", { name: "Review rows", exact: true })
    .click();
  await expect(
    dialog.getByText("Current purchase", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Old delayed purchase", { exact: true }),
  ).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Import 1 transaction", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cresco-finance-preview-v1")!),
  );
  expect(saved.transactions).toHaveLength(1);
  expect(saved.transactions[0]).toMatchObject({
    accountId: "savings",
    description: "Current purchase",
    amount: -3456,
  });
});
