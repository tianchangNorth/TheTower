// Phase 3 功能 smoke：需后端 API + dev server。验证 /agents/[id] 编辑 displayName → 保存 → API 反映 → 还原。
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:5173";

async function firstAgent() {
  const res = await fetch(`${BASE}/api/agents`);
  const body = await res.json();
  return body.agents[0];
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

let failures = 0;
try {
  const agent = await firstAgent();
  const original = agent.displayName;
  const marked = `${original} #smoke`;

  await page.goto(`${BASE}/agents/${agent.id}`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Display name").waitFor({ timeout: 10000 });

  // 编辑 → dirty → save → saved
  await page.getByLabel("Display name").fill(marked);
  await page.getByText("dirty").first().waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByText("saved").first().waitFor({ timeout: 10000 });

  // API 反映新名
  const after = await firstAgent();
  if (after.id !== agent.id || after.displayName !== marked) {
    console.error(`保存未反映：期望 ${marked}，实际 ${after.displayName}`);
    failures += 1;
  } else {
    console.log(`保存反映成功：${marked} ✓`);
  }
  await page.screenshot({ path: "/tmp/smoke-agents-detail.png" });

  // 还原
  await page.getByLabel("Display name").fill(original);
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByText("saved").first().waitFor({ timeout: 10000 });
  const restored = await firstAgent();
  if (restored.displayName !== original) {
    console.error(`还原失败：期望 ${original}，实际 ${restored.displayName}`);
    failures += 1;
  } else {
    console.log(`还原成功：${original} ✓`);
  }
} catch (err) {
  console.error("功能 smoke 失败:", err.message);
  failures += 1;
}

await browser.close();
if (failures) process.exit(1);
console.log("agents 功能 smoke 通过。");
