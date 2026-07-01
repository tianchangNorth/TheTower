// Phase 6 功能 smoke：需后端 API + dev server。验证建 task、从 task 建 thread 跳回 Command、settings 渲染。
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:5173";

async function postJson(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return res.json();
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

let failures = 0;
try {
  // 建任务 + 从任务建空 thread（不触发 LLM）
  const { task } = await postJson("/api/tasks", { title: "Smoke task", priority: "high" });
  if (!task) throw new Error("create task failed");
  const linked = await postJson(`/api/tasks/${encodeURIComponent(task.id)}/create-thread`, {});
  if (!linked.thread) throw new Error("create-thread failed");

  // /tasks 列表含该任务
  await page.goto(`${BASE}/tasks`, { waitUntil: "domcontentloaded" });
  await page.getByText("Smoke task").first().waitFor({ timeout: 10000 });
  console.log(`/tasks 列表含 “Smoke task” ✓`);
  await page.screenshot({ path: "/tmp/smoke-tasks-list.png" });

  // /tasks/[id] 详情 + linked thread
  await page.goto(`${BASE}/tasks/${task.id}`, { waitUntil: "domcontentloaded" });
  await page.getByText("Linked threads").waitFor({ timeout: 10000 });
  await page.getByText(linked.thread.title).first().waitFor({ timeout: 10000 });
  console.log(`/tasks/[id] 详情含 linked thread ✓`);
  await page.screenshot({ path: "/tmp/smoke-tasks-detail.png" });

  // 从 task 创建的 thread 跳回 Command
  await page.goto(`${BASE}/threads/${linked.thread.id}`, { waitUntil: "domcontentloaded" });
  await page.getByText("TheTower", { exact: false }).first().waitFor({ timeout: 10000 });
  console.log(`/threads/[id] 跳回 Command ✓`);

  // /settings 渲染
  await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
  await page.getByText("Service health").first().waitFor({ timeout: 10000 });
  await page.getByText("Providers").first().waitFor({ timeout: 10000 });
  await page.getByText("MCP servers").first().waitFor({ timeout: 10000 });
  console.log(`/settings 渲染各 section ✓`);
  await page.screenshot({ path: "/tmp/smoke-settings.png" });
} catch (err) {
  console.error("tasks/settings smoke 失败:", err.message);
  failures += 1;
}

await browser.close();
if (failures) process.exit(1);
console.log("tasks/settings 功能 smoke 通过。");
