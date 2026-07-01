// Phase 5 功能 smoke：需后端 API + dev server。验证 /workspaces 列表、详情、activity 接口与页面。
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:5173";

async function firstWorkspace() {
  const res = await fetch(`${BASE}/api/workspaces`);
  const body = await res.json();
  return body.workspaces[0];
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

let failures = 0;
try {
  const ws = await firstWorkspace();
  if (!ws) throw new Error("no workspaces in backend to smoke against");

  const detailRes = await fetch(`${BASE}/api/workspaces/${encodeURIComponent(ws.id)}`);
  const actRes = await fetch(`${BASE}/api/workspaces/${encodeURIComponent(ws.id)}/activity`);
  if (detailRes.status !== 200) { console.error(`detail 接口 ${detailRes.status}`); failures += 1; }
  if (actRes.status !== 200) { console.error(`activity 接口 ${actRes.status}`); failures += 1; }
  else {
    const act = await actRes.json();
    if (!act.workspace || act.workspace.id !== ws.id) { console.error("activity 接口返回异常"); failures += 1; }
    else { console.log(`activity 接口 200，threads=${act.threads.length} activity=${act.activity.length} ✓`); }
  }

  await page.goto(`${BASE}/workspaces`, { waitUntil: "domcontentloaded" });
  await page.getByText("Workspaces", { exact: false }).first().waitFor({ timeout: 10000 });
  await page.getByText(ws.name).first().waitFor({ timeout: 10000 });
  console.log(`/workspaces 列表含 “${ws.name}” ✓`);
  await page.screenshot({ path: "/tmp/smoke-workspaces-list.png" });

  await page.goto(`${BASE}/workspaces/${ws.id}`, { waitUntil: "domcontentloaded" });
  await page.getByText("Thread bindings").waitFor({ timeout: 10000 });
  await page.getByText("Workspace activity").waitFor({ timeout: 10000 });
  console.log(`/workspaces/[id] 详情渲染 ✓`);
  await page.screenshot({ path: "/tmp/smoke-workspaces-detail.png" });
} catch (err) {
  console.error("workspace smoke 失败:", err.message);
  failures += 1;
}

await browser.close();
if (failures) process.exit(1);
console.log("workspace 功能 smoke 通过。");
