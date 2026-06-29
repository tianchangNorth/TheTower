import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { initSchema } from "../src/db/schema.js";
import { EventBus, type ServerEvent } from "../src/events/EventBus.js";
import { WorkspaceFileService } from "../src/services/WorkspaceFileService.js";
import { CallbackTokenStore } from "../src/stores/CallbackTokenStore.js";
import { InvocationStore } from "../src/stores/InvocationStore.js";
import { MessageStore } from "../src/stores/MessageStore.js";
import { ThreadStore } from "../src/stores/ThreadStore.js";

test("WorkspaceFileService writes, reads, slices, and audits inside thread workspace", async () => {
  const fixture = await makeFixture();
  try {
    const writeResult = await fixture.service.writeFile({
      ...fixture.callback,
      path: "notes/intro.md",
      content: "line 1\nline 2\nline 3\n",
    });
    assert.equal(await readFile(join(fixture.workspace, "notes", "intro.md"), "utf8"), "line 1\nline 2\nline 3\n");
    assert.equal(writeResult.bytes, 21);

    const readResult = await fixture.service.readFile({ ...fixture.callback, path: "notes/intro.md" });
    assert.equal(readResult.content, "line 1\nline 2\nline 3\n");

    const slice = await fixture.service.readFileSlice({
      ...fixture.callback,
      path: "notes/intro.md",
      startLine: 2,
      endLine: 3,
    });
    assert.equal(slice.content, "2: line 2\n3: line 3");

    assert.equal(fixture.events.filter((event) => event.type === "workspace.file_tool").length, 3);
    assert.equal(
      fixture.events.some((event) => event.type === "workspace.file_tool" && event.tool === "write_file" && !event.denied),
      true,
    );
  } finally {
    await fixture.cleanup();
  }
});

test("WorkspaceFileService rejects paths outside workspace and symlink escapes", async () => {
  const fixture = await makeFixture();
  const outside = await mkdtemp(join(tmpdir(), "tower-file-outside-"));
  try {
    await assert.rejects(
      () =>
        fixture.service.writeFile({
          ...fixture.callback,
          path: join(outside, "escape.txt"),
          content: "nope",
        }),
      /outside workspace/,
    );

    const outsideFile = join(outside, "outside.txt");
    await writeFile(outsideFile, "secret");
    await symlink(outsideFile, join(fixture.workspace, "link.txt"));
    await assert.rejects(
      () => fixture.service.writeFile({ ...fixture.callback, path: "link.txt", content: "nope" }),
      /outside workspace/,
    );
    assert.equal((await readFile(outsideFile, "utf8")), "secret");
    assert.equal(
      fixture.events.some((event) => event.type === "workspace.file_tool" && event.denied),
      true,
    );
  } finally {
    await fixture.cleanup();
    await rm(outside, { recursive: true, force: true });
  }
});

test("WorkspaceFileService list_files skips .git and node_modules", async () => {
  const fixture = await makeFixture();
  try {
    await mkdir(join(fixture.workspace, ".git"));
    await mkdir(join(fixture.workspace, "node_modules"));
    await mkdir(join(fixture.workspace, "src"));
    await writeFile(join(fixture.workspace, "README.md"), "hello");

    const result = await fixture.service.listFiles({ ...fixture.callback });
    assert.deepEqual(result.entries.sort(), ["README.md", "src/"]);
  } finally {
    await fixture.cleanup();
  }
});

async function makeFixture(): Promise<{
  service: WorkspaceFileService;
  workspace: string;
  callback: { invocationId: string; callbackToken: string; agentId: string };
  events: ServerEvent[];
  cleanup: () => Promise<void>;
}> {
  const root = await mkdtemp(join(tmpdir(), "tower-file-root-"));
  const workspace = await mkdtemp(join(root, "workspace-"));
  const previousAllowedRoots = process.env.THE_TOWER_PROJECT_ALLOWED_ROOTS;
  process.env.THE_TOWER_PROJECT_ALLOWED_ROOTS = await realpath(root);

  const db = new Database(":memory:");
  initSchema(db);
  const threadStore = new ThreadStore(db);
  const messageStore = new MessageStore(db);
  const invocationStore = new InvocationStore(db);
  const callbackTokenStore = new CallbackTokenStore(db);
  const events = new EventBus();
  const capturedEvents: ServerEvent[] = [];
  events.subscribe((event) => capturedEvents.push(event));

  threadStore.create({
    id: "thread-1",
    title: "Workspace test",
    mode: "debug",
    projectPath: workspace,
    createdAt: 1,
    updatedAt: 1,
  });
  messageStore.create({
    id: "message-1",
    threadId: "thread-1",
    senderType: "user",
    content: "root",
    mentions: [],
    createdAt: 1,
  });
  invocationStore.create({
    id: "invocation-1",
    threadId: "thread-1",
    rootMessageId: "message-1",
    status: "running",
    targetAgents: ["agent-a"],
    depth: 0,
    createdAt: 1,
  });
  callbackTokenStore.create({
    invocationId: "invocation-1",
    token: "token-1",
    expiresAt: Date.now() + 60_000,
  });

  const service = new WorkspaceFileService({
    invocationStore,
    callbackTokenStore,
    threadStore,
    events,
  });

  return {
    service,
    workspace,
    callback: { invocationId: "invocation-1", callbackToken: "token-1", agentId: "agent-a" },
    events: capturedEvents,
    cleanup: async () => {
      if (previousAllowedRoots === undefined) delete process.env.THE_TOWER_PROJECT_ALLOWED_ROOTS;
      else process.env.THE_TOWER_PROJECT_ALLOWED_ROOTS = previousAllowedRoots;
      await rm(root, { recursive: true, force: true });
    },
  };
}
