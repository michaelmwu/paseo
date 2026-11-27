import { expect, test } from "../support/fixtures";

test("settings search renders only matching settings groups", async ({ page }) => {
  await page.goto("/settings");

  const search = page.getByTestId("settings-search");
  const sidebar = page.getByTestId("settings-sidebar");
  await expect(search).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Appearance", exact: true })).toBeVisible();
  await search.fill("Send");

  const results = page.getByTestId("settings-search-results");
  await expect(results).toBeVisible();
  await expect(results.getByText("Sending", { exact: true })).toBeVisible();
  await expect(results.getByText("Send shortcut", { exact: true })).toBeVisible();
  await expect(results.getByText("Projects & Workspaces", { exact: true })).not.toBeVisible();
  await expect(results.getByText("Open project", { exact: true })).not.toBeVisible();
  await expect(results.getByText("Appearance", { exact: true })).not.toBeVisible();
  await expect(results.getByText("Danger zone", { exact: true })).not.toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Appearance", exact: true })).toHaveCount(0);

  await search.fill("Plan");
  await expect(results.getByText("Plan usage", { exact: true })).toBeVisible();
  await expect(results.getByText("Metadata generation", { exact: true })).not.toBeVisible();
  await expect(results.getByText("Sending", { exact: true })).not.toBeVisible();

  await search.fill("Profile");
  await expect(results.getByText("Agent profiles", { exact: true })).toBeVisible();
  await expect(results.getByText("Terminal agents", { exact: true })).not.toBeVisible();
  await expect(results.getByText("Plan usage", { exact: true })).not.toBeVisible();

  await search.fill("");
  await expect(sidebar.getByRole("button", { name: "Appearance", exact: true })).toBeVisible();
  await expect(results).toHaveCount(0);
});

for (const width of [1280, 390]) {
  test(`search opens device Terminal and host Tailscale settings at width ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto("/settings");
    await page.getByTestId("settings-search").fill("Terminal");
    await page.getByTestId("settings-section-chat").click();
    await expect(page).toHaveURL(/\/settings\/chat$/);
    await page.goto("/settings");
    await page.getByTestId("settings-search").fill("Tailscale");
    await page.getByTestId("settings-host-section-devices").click();
    await expect(page).toHaveURL(/\/settings\/hosts\/[^/]+\/devices$/);
  });
}
