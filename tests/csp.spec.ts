import { test, expect } from "@playwright/test";
test("production CSP allows dialogs, tabs, theme and selection surfaces", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as unknown as { violations: string[] }).violations = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      (window as unknown as { violations: string[] }).violations.push(
        e.violatedDirective,
      ),
    );
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "New habit", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Check off", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Theme", exact: true })
    .selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(
      () => (window as unknown as { violations: string[] }).violations,
    ),
  ).toEqual([]);
});
