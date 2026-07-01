// HomePage + 新建 Thread 弹窗 + 路径选择器 smoke。
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:5173";
const PICK_PATH = "/Users/xuchenyang/ai/TheTower";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

let failures = 0;
try {
  // 1. / 是 HomePage（不是 Command），含徽记 + New thread CTA
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "TheTower" }).waitFor({ timeout: 10000 });
  await page.locator('svg[aria-label="TheTower emblem"]').waitFor({ timeout: 5000 });
  await page.getByText("Recent threads").first().waitFor({ timeout: 5000 });
  console.log("/ HomePage 渲染（徽记 + Recent threads）✓");

  // 2. New thread → CreateThreadDialog
  await page.getByRole("button", { name: "New thread" }).click();
  await page.getByRole("heading", { name: "New thread", exact: true }).waitFor({ timeout: 5000 });
  console.log("CreateThreadDialog 弹出 ✓");

  // 3. 填 name
  await page.getByLabel("Thread name").fill("Smoke Home");

  // 4. Browse → inline PathPicker
  await page.getByRole("button", { name: "Browse…" }).click();
  await page.getByText("选择工作目录", { exact: true }).waitFor({ timeout: 5000 });
  await page.getByPlaceholder("(默认 home 目录)").fill(PICK_PATH);
  await page.getByPlaceholder("(默认 home 目录)").press("Enter");
  // 等待该目录的子目录出现，确认 listing 已加载
  await page.getByText("packages").first().waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: "Select" }).click();
  // PathPicker 关闭，回到 CreateThreadDialog 表单
  await page.getByLabel("Thread name").waitFor({ timeout: 5000 });
  console.log("PathPicker 选定路径回填 ✓");

  // 5. Create → 跳转 /threads/[id]
  await page.getByRole("button", { name: "Create" }).click();
  await page.waitForURL(/\/threads\//, { timeout: 10000 });
  const segs = new URL(page.url()).pathname.split("/");
  const newId = segs.at(-1);
  console.log("跳转到 /threads/" + newId + " ✓");

  // 6. Command 标题 = Smoke Home
  await page.getByText("Smoke Home").first().waitFor({ timeout: 5000 });
  console.log("Command 标题 = Smoke Home ✓");

  // 7. 后端确有该 thread
  const th = await (await fetch(`${BASE}/api/threads`)).json();
  const found = th.threads.find((t) => t.id === newId);
  if (!found || found.title !== "Smoke Home" || !found.projectPath?.includes("TheTower")) {
    console.error("后端 thread 校验失败:", JSON.stringify(found));
    failures += 1;
  } else {
    console.log("后端 thread 校验通过 ✓");
  }
  await page.screenshot({ path: "/tmp/smoke-home.png" });
} catch (err) {
  console.error("home smoke 失败:", err.message);
  failures += 1;
}

await browser.close();
if (failures) process.exit(1);
console.log("home 功能 smoke 通过。");
