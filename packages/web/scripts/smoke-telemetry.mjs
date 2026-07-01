// Phase 4 功能 smoke：需后端 API + dev server。验证 /telemetry 渲染、thread 选择、context、tabs。
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:5173";

async function firstThreadId() {
  const res = await fetch(`${BASE}/api/telemetry/threads`);
  const body = await res.json();
  return body.threads[0]?.thread;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

let failures = 0;
try {
  const thread = await firstThreadId();
  if (!thread) throw new Error("no threads in backend to smoke against");

  // /telemetry 渲染 + timeline 含该 thread
  await page.goto(`${BASE}/telemetry`, { waitUntil: "domcontentloaded" });
  await page.getByText("Thread timeline").waitFor({ timeout: 10000 });
  await page.getByText(thread.title).first().waitFor({ timeout: 10000 });
  console.log(`/telemetry 渲染，timeline 含 “${thread.title}” ✓`);
  await page.screenshot({ path: "/tmp/smoke-telemetry.png" });

  // 切换 Events / Invocations tabs 不崩
  await page.getByRole("tab", { name: "Events" }).click();
  await page.getByRole("tab", { name: "Invocations" }).click();
  console.log("tabs 切换正常 ✓");

  // /telemetry/[threadId] → context 加载
  await page.goto(`${BASE}/telemetry/${thread.id}`, { waitUntil: "domcontentloaded" });
  await page.getByText("Thread context").waitFor({ timeout: 10000 });
  await page.getByText(thread.title).first().waitFor({ timeout: 10000 });
  await page.getByText("Messages").first().waitFor({ timeout: 10000 });
  console.log(`/telemetry/[threadId] context 加载 ✓`);
  await page.screenshot({ path: "/tmp/smoke-telemetry-context.png" });

  // 验证 context 来自后端查询（刷新后仍在）
  const ctxRes = await fetch(`${BASE}/api/threads/${encodeURIComponent(thread.id)}/context`);
  if (ctxRes.status !== 200) {
    console.error(`context 接口 ${ctxRes.status}`);
    failures += 1;
  } else {
    const ctx = await ctxRes.json();
    if (!ctx.thread || ctx.thread.id !== thread.id) {
      console.error("context 接口返回异常");
      failures += 1;
    } else {
      console.log(`context 接口 200，messages total=${ctx.messageCounts.total} ✓`);
    }
  }
} catch (err) {
  console.error("telemetry smoke 失败:", err.message);
  failures += 1;
}

await browser.close();
if (failures) process.exit(1);
console.log("telemetry 功能 smoke 通过。");
