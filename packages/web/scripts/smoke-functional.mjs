// Phase 2 功能 smoke：需后端 API 运行。验证 Command 页拉取 agents、渲染装备卡、SSE 连接。
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:5173";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

let failures = 0;
try {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
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
