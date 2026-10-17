import { test, expect } from "@playwright/test";

test("application mark and favicon load under the current security policy", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      throw Error("Blocked application asset: " + event.violatedDirective);
    });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const mark = page.locator('img[src="/mark.png"]');
  const size = await mark.evaluate(async (element) => {
    const image = element as HTMLImageElement;
    await image.decode();
    return [image.naturalWidth, image.naturalHeight, image.width, image.height];
  });
  expect(size).toEqual([128, 128, 34, 34]);
  const favicon = await page
    .locator('link[rel="icon"]')
    .evaluate((element) => new URL((element as HTMLLinkElement).href).pathname);
  expect(favicon).toBe("/favicon.png");
  expect(
    await page.evaluate(async (url) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    }, favicon),
  ).toEqual([32, 32]);
  for (const theme of ["light", "dark"]) {
    await page
      .getByRole("combobox", { name: "Theme", exact: true })
      .selectOption(theme);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(mark).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: testInfo.outputPath("branding-desktop-" + theme + ".png"),
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(mark).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("branding-mobile-dark.png"),
  });
  expect(errors).toEqual([]);
});
