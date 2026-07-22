import { expect, test } from "@playwright/test";

test("member entry communicates the product identity", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("ordah please");
  await expect(page.getByRole("main")).toContainText("ordah please");
});
