// 全局确认弹窗 smoke：删 thread 时弹出 AlertDialog（非浏览器 confirm），取消不删除。
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:5173";

async function firstThread() {
  const res = await fetch(`${BASE}/api/threads`);
  const body = await res.json();
  if (body.threads[0]) return body.threads[0];
  // 没有则建一个空 thread
  const created = await (
    await fetch(`${BASE}/api/threads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Smoke confirm" }),
    })
  ).json();
  return created.thread;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

let failures = 0;
try {
  const thread = await firstThread();
  if (!thread) throw new Error("no threads to test delete confirm");

  await page.goto(`${BASE}/threads/${thread.id}`, { waitUntil: "domcontentloaded" });
  await page.getByText(thread.title).first().waitFor({ timeout: 10000 });

  // 点删除 → 应弹 AlertDialog（delete 按钮为 hover 显现，用 dispatchEvent 触发 onClick）
  await page.locator('button[aria-label^="Delete thread"]').first().dispatchEvent("click");
  await page.getByRole("alertdialog").waitFor({ timeout: 5000 });
  console.log("AlertDialog 弹出 ✓");
  await page.screenshot({ path: "/tmp/smoke-confirm.png" });

  // 取消 → 弹窗关闭
  await page.getByRole("button", { name: "取消" }).click();
  await page.getByRole("alertdialog").waitFor({ state: "detached", timeout: 5000 });
  console.log("取消后弹窗关闭 ✓");

  // thread 仍在
  const after = await fetch(`${BASE}/api/threads`).then((r) => r.json());
  if (!after.threads.some((t) => t.id === thread.id)) {
    console.error("thread 被误删");
    failures += 1;
  } else {
    console.log("thread 仍在（未删除）✓");
  }
} catch (err) {
  console.error("confirm smoke 失败:", err.message);
  failures += 1;
}

await browser.close();
if (failures) process.exit(1);
console.log("confirm 弹窗 smoke 通过。");
