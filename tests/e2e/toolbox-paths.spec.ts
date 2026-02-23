import { expect, test } from "@playwright/test";

test.describe("Toolbox visiting path sync", () => {
  test("image and video modes keep URL in sync", async ({ page }) => {
    await page.goto("/toolbox");

    await expect(page.getByRole("heading", { name: "Media Studio" })).toBeVisible();

    await page.getByRole("button", { name: /Image \+ Text to Image/i }).click();
    await expect(page).toHaveURL(/\/toolbox\?tab=image&mode=i2i_text$/);
    await expect(page.getByText("Visiting Path:")).toBeVisible();
    await expect(
      page.locator("code", { hasText: "/toolbox?tab=image&mode=i2i_text" }).first()
    ).toBeVisible();

    await page.getByRole("button", { name: /^Video$/ }).click();
    await expect(page).toHaveURL(/\/toolbox\?tab=video&mode=t2v$/);

    await page.getByRole("button", { name: /Image to Video/i }).click();
    await expect(page).toHaveURL(/\/toolbox\?tab=video&mode=i2v$/);
    await expect(
      page.locator("code", { hasText: "/toolbox?tab=video&mode=i2v" }).first()
    ).toBeVisible();

    await expect(page.getByText("Estimated Usage & Cost")).toBeVisible();
  });
});
