// Phase 2 功能 smoke：需后端 API 运行。验证 Command 页拉取 agents、渲染装备卡、SSE 连接。
// / 现为 HomePage，Command 在 /threads/[id]，故先取一个真实 thread 进入。
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:5173";

async function firstThreadId() {
  const res = await fetch(`${BASE}/api/threads`);
  const body = await res.json();
  if (body.threads[0]) return body.threads[0].id;
  // 没有则建一个空 thread
  const created = await (
    await fetch(`${BASE}/api/threads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Smoke functional" }),
    })
  ).json();
  return created.thread.id;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

let failures = 0;
try {
  const tid = await firstThreadId();
  if (!tid) throw new Error("no threads to land on Command");
  await page.goto(`${BASE}/threads/${tid}`, { waitUntil: "domcontentloaded" });
  // 等待至少一张 Agent 装备卡渲染（来自后端 agents）。
  await page.locator("a:has-text('Configure')").first().waitFor({ timeout: 10000 });
  const cards = await page.locator("a:has-text('Configure')").count();
  console.log(`Agents 装备卡: ${cards} 张 ✓`);
  await page.screenshot({ path: "/tmp/smoke-command.png" });

  // SSE 应在 connected 后不再显示断线横幅。
  const disconnected = await page.locator("text=SSE disconnected").count();
  if (disconnected > 0) {
    console.error(`SSE 断线横幅仍显示（${disconnected}）`);
    failures += 1;
  } else {
    console.log("SSE 无断线横幅 ✓");
  }
} catch (err) {
  console.error("功能 smoke 失败:", err.message);
  failures += 1;
}

await browser.close();
if (failures) process.exit(1);
console.log("功能 smoke 通过。");

