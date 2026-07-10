import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { initSchema } from "../src/db/schema.js";
import { EventBus } from "../src/events/EventBus.js";
import { EventLogStore } from "../src/stores/EventLogStore.js";

test("EventBus persists sequence IDs and replays entries after reconnect", () => {
  const database = new Database(":memory:");
  initSchema(database);
  const events = new EventBus(new EventLogStore(database));

  events.publish({ type: "message.created", threadId: "thread-1", messageId: "message-1" });
  events.publish({ type: "invocation.updated", threadId: "thread-1", invocationId: "inv-1", status: "running" });

  assert.deepEqual(events.replayAfter(0).map((entry) => entry.seq), [1, 2]);
  assert.deepEqual(events.replayAfter(1).map((entry) => entry.event.type), ["invocation.updated"]);

  const restarted = new EventBus(new EventLogStore(database));
  assert.deepEqual(restarted.replayAfter(1).map((entry) => entry.seq), [2]);
  database.close();
});
