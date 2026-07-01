/**
 * 边界语义镜像后端 packages/api/src/routing/MentionParser.ts，
 * 保证前端补全触发的 @ 输入与后端 parseMentions 路由一致。
 */
const MENTION_BOUNDARY_RE = /[\s,.:;!?()[\]{}<>，。！？、：；（）【】《》「」『』〈〉]/;
const HANDLE_CONTINUATION_RE = /[a-z0-9_.-]/i;

function isBoundary(ch: string | undefined): boolean {
  return !ch || MENTION_BOUNDARY_RE.test(ch);
}

/**
 * 从 caret 往回找当前激活的 @mention 输入：返回 @ 位置与 query。
 * 规则：@ 在串首或前一字符为 boundary；@ 到 caret 之间全是 handle 续字符。
 * 光标前一字符为 boundary（空格/标点等）时，mention 输入已封闭，返回 null。
 * @ 本身不是 boundary，所以「刚敲下 @」仍触发。
 * 无激活输入返回 null（不弹补全）。
 */
export function detectMentionQuery(
  content: string,
  caret: number,
): { at: number; query: string } | null {
  if (caret > 0 && isBoundary(content[caret - 1])) return null;
  const at = findAtBefore(content, caret);
  if (at < 0) return null;
  return { at, query: content.slice(at + 1, caret) };
}

/** 从 caret-1 往回：跳过 handle 续字符，找到边界合法的 @；否则返回 -1。 */
function findAtBefore(content: string, caret: number): number {
  let i = caret - 1;
  while (i >= 0) {
    const ch = content[i];
    if (ch === "@") {
      return isBoundary(content[i - 1]) ? i : -1;
    }
    if (!HANDLE_CONTINUATION_RE.test(ch)) return -1;
    i--;
  }
  return -1;
}
