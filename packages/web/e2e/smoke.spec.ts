import { expect, test } from "@playwright/test";

test("production shell loads API-backed home state", async ({ page, request }) => {
  const agentsResponse = page.waitForResponse((response) =>
    response.url().includes("/api/agents") && response.request().method() === "GET",
  );

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "TheTower" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New thread" })).toBeVisible();
  await expect((await agentsResponse).ok()).toBeTruthy();

  const health = await request.get("/health");
  expect(health.ok()).toBeTruthy();
  await expect(health.json()).resolves.toEqual({ ok: true });
});
