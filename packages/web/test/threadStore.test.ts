import { test } from "node:test";
import assert from "node:assert/strict";
import { useThreadStore } from "../src/stores/threadStore";

const store = useThreadStore;

test("threadStore: per-thread draft 独立，切换 thread 不清空其他 draft", () => {
  store.setState({ draftByThreadId: {}, filterByThreadId: {}, unreadByThreadId: {} });
  store.getState().setDraft("a", "draftA");
  store.getState().setDraft(undefined, "draftNew");
  store.getState().setDraft("b", "draftB");
  assert.equal(store.getState().getDraft("a"), "draftA");
  assert.equal(store.getState().getDraft("b"), "draftB");
  assert.equal(store.getState().getDraft(undefined), "draftNew");

  // 修改 b 不影响 a；模拟切换到 b 再切回 a，a 的 draft 仍在。
  store.getState().setDraft("b", "draftB-updated");
  store.getState().setCurrentThreadId("b");
  store.getState().setCurrentThreadId("a");
  assert.equal(store.getState().getDraft("a"), "draftA");
  assert.equal(store.getState().getDraft("b"), "draftB-updated");
});

test("threadStore: per-thread filter 独立，默认 all", () => {
  store.setState({ filterByThreadId: {} });
  assert.equal(store.getState().getFilter("a"), "all");
  store.getState().setFilter("a", "private");
  store.getState().setFilter("b", "handoff");
  assert.equal(store.getState().getFilter("a"), "private");
  assert.equal(store.getState().getFilter("b"), "handoff");
  assert.equal(store.getState().getFilter(undefined), "all");
});
