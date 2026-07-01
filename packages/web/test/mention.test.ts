import { test } from "node:test";
import assert from "node:assert/strict";
import { detectMentionQuery } from "../src/lib/mention";

test("detectMentionQuery: @ 在串首触发，query 空", () => {
  assert.deepEqual(detectMentionQuery("@", 1), { at: 0, query: "" });
  assert.deepEqual(detectMentionQuery("@zav", 4), { at: 0, query: "zav" });
});

test("detectMentionQuery: 前置 boundary 才触发", () => {
  assert.deepEqual(detectMentionQuery("hi @z", 5), { at: 3, query: "z" });
  // x@zav 前置 x 非 boundary → null
  assert.equal(detectMentionQuery("x@zav", 5), null);
});

test("detectMentionQuery: handle 后敲空格封闭，不再弹窗", () => {
  // "hi @zavala " 长度 11，光标在尾空格后 → content[10] 为空格 boundary → null
  assert.equal(detectMentionQuery("hi @zavala ", 11), null);
  // 光标停在 handle 续字符中（未敲空格）仍触发
  assert.deepEqual(detectMentionQuery("hi @zava", 8), { at: 3, query: "zava" });
});
