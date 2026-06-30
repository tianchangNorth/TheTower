// Phase 1b Playwright smoke：≥1440 断点，验证路由 200、布局不崩、Shell 元素存在。
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:5174";
const routes = ["/", "/agents", "/telemetry", "/workspaces", "/tasks", "/settings"];
const screenshotRoutes = ["/", "/agents"];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

let failures = 0;
for (const route of routes) {
  const res = await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
  const status = res?.status() ?? 0;
  if (status !== 200) {
    console.error(`${route}: HTTP ${status}`);
    failures += 1;
    continue;
  }
  if (screenshotRoutes.includes(route)) {
    const name = route === "/" ? "home" : route.slice(1);
    await page.locator("text=TheTower").first().waitFor({ timeout: 5000 });
    await page.screenshot({ path: `/tmp/smoke-${name}.png` });
  }
  console.log(`${route}: ${status} ✓`);
}

// 布局断言：首页存在顶部 brand 与活动导航。
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.locator("text=TheTower").first().waitFor({ timeout: 5000 });
const navCount = await page.locator("nav a").count();
if (navCount < 6) {
  console.error(`布局断言失败：活动导航链接数 ${navCount}（预期 ≥6）`);
  failures += 1;
}

await browser.close();

if (failures) {
  console.error(`\nsmoke 失败：${failures} 项`);
  process.exit(1);
}
console.log("\nsmoke 通过：所有路由 200，Shell 元素存在，布局未崩。");
