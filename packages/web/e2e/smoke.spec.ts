import { expect, test, type Page } from "@playwright/test";

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

test("creates a thread and completes a mock runner stream", async ({ page }) => {
  const title = `E2E send ${Date.now()}`;
  await createThread(page, title);

  await expect(page.locator("main").getByText(title, { exact: true }).last()).toBeVisible();
  await sendCommand(page, "@ikora R0.7 successful send fixture");

  await expect(page.getByText("@ikora R0.7 successful send fixture", { exact: true })).toBeVisible();
  await expect(page.getByText("Thinking", { exact: true })).toBeVisible({ timeout: 10_000 });
  await page.getByText("Thinking", { exact: true }).click();
  await expect(page.locator("pre").filter({ hasText: "我是 Ikora Rey" })).toBeVisible({ timeout: 10_000 });
});

test("reveals a private callback", async ({ page }) => {
  await page.goto("/threads/e2e-private-callback");

  await expect(page.getByText("R0.7 private callback fixture", { exact: true })).toBeVisible();
  await expect(page.getByText("private", { exact: true })).toBeVisible();
  await expect(page.getByText("callback", { exact: true })).toBeVisible();

  await page.getByTitle("Reveal private message").click();
  await expect(page.getByText("revealed", { exact: true })).toBeVisible();
});

test("stops an active invocation", async ({ page, request }) => {
  await createThread(page, `E2E stop ${Date.now()}`);
  const threadId = page.url().split("/").at(-1);
  expect(threadId).toBeTruthy();

  await sendCommand(page, "@ikora R0.7 cancellable fixture");
  await expect(page.getByRole("button", { name: "Stop", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Stop", exact: true }).click();

  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeVisible();
  await expect.poll(async () => {
    const response = await request.get(`/api/threads/${threadId}/invocations`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json() as { invocations: Array<{ status: string }> };
    return body.invocations[0]?.status;
  }).toBe("cancelled");
});

test("shows a stable provider failure", async ({ page }) => {
  await createThread(page, `E2E failure ${Date.now()}`);
  await sendCommand(page, "@shaxx R0.7 failure fixture");

  await expect(page.getByText(/Agent provider "gemini" is not supported/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeVisible();
});

test("surfaces an SSE disconnect and reconnects", async ({ page }) => {
  await page.goto("/threads/e2e-private-callback");
  await expect(page.getByTitle("SSE synced")).toBeVisible({ timeout: 10_000 });

  const eventStream = "http://127.0.0.1:33001/api/events";
  await page.route(eventStream, (route) => route.fulfill({ status: 503, body: "temporarily unavailable" }));
  await page.reload();
  await expect(page.getByTitle("SSE reconnecting")).toBeVisible();

  await page.unroute(eventStream);
  await page.reload();
  await expect(page.getByTitle("SSE synced")).toBeVisible({ timeout: 10_000 });
});

async function createThread(page: Page, title: string): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "New thread" }).click();
  await page.getByPlaceholder("任务 / 会话标题").fill(title);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/threads\/[^/]+$/);
}

async function sendCommand(page: Page, content: string): Promise<void> {
  await page.getByPlaceholder("向 Agent 下达指令…  输入 @ 触发补全").fill(content);
  await page.getByRole("button", { name: "Send", exact: true }).click();
}
