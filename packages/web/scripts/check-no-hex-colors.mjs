// 硬编码颜色门禁：检测业务 .ts/.tsx 中的 hex 与 rgb()/rgba() 字面量。
// 颜色必须走 --tower-* token（foundation 层 tower-tokens.css 是唯一允许 hex 的文件，本脚本只扫 src 代码）。
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { relative } from "node:path";

const srcRoot = fileURLToPath(new URL("../src", import.meta.url));

// 白名单：Phase 2 已清除旧调试台浅色子系统，无例外。新增 hex 必须先入 tower-tokens.css。
const WHITELIST = new Set();

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const RGB = /\brgba?\([^)]*\)/g;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = `${dir}/${entry}`;
    if (statSync(p).isDirectory()) {
      yield* walk(p);
    } else if (p.endsWith(".ts") || p.endsWith(".tsx")) {
      yield p;
    }
  }
}

let failures = 0;
for (const file of walk(srcRoot)) {
  const rel = relative(srcRoot, file).replaceAll("\\", "/");
  if (WHITELIST.has(rel)) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const re of [HEX, RGB]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line))) {
        console.error(`${rel}:${i + 1}: 禁止硬编码颜色 "${m[0]}"，改用 --tower-* token`);
        failures += 1;
      }
    }
  });
}

if (failures) {
  console.error(`\n颜色门禁失败：${failures} 处硬编码颜色。`);
  process.exit(1);
}
console.log("颜色门禁通过：业务代码无硬编码颜色。");
