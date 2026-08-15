import { expect, test } from "bun:test";
import type { FsNode, FsService, NodeId, Revision, WriteOptions } from "../../os/contracts/index.ts";
import { DocumentSession } from "./document.ts";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class AutosaveFs {
  readonly nodeId = "document" as NodeId;
  private revisionValue = 1n;
  private modifiedAt = 1;
  private content = new TextEncoder().encode("before");

  readonly service = {
    stat: async (id: NodeId) => {
      if (id !== this.nodeId) throw new Error("missing document");
      return this.node();
    },
    read: async (id: NodeId) => {
      if (id !== this.nodeId) throw new Error("missing document");
      return this.content.slice();
    },
    write: async (id: NodeId, data: Uint8Array, _options?: WriteOptions) => {
      if (id !== this.nodeId) throw new Error("missing document");
      this.content = data.slice();
      this.modifiedAt += 1;
      this.revisionValue += 1n;
      return this.node();
    },
    revision: async (): Promise<Revision> => this.revisionValue,
  } as unknown as FsService;

  text(): string {
    return new TextDecoder().decode(this.content);
  }

  private node(): FsNode {
    return {
      id: this.nodeId,
      parentId: "root" as NodeId,
      name: "notes.txt",
      kind: "file",
      mime: "text/plain",
      size: this.content.byteLength,
      contentHash: `h:${this.text()}`,
      createdAt: 1,
      modifiedAt: this.modifiedAt,
      metadata: {},
    };
  }
}

test("autosave defaults OFF even when a debounce duration is configured", async () => {
  const fs = new AutosaveFs();
  const session = new DocumentSession(fs.service, { autosaveMs: 10 });
  await session.setTarget(fs.nodeId);

  session.edit("unsaved draft");
  await delay(30);

  expect(fs.text()).toBe("before");
  expect(session.snapshot().dirty).toBe(true);
  expect(session.snapshot().text).toBe("unsaved draft");
  session.dispose();
});

test("autosave persists only after explicit opt-in through the shared session", async () => {
  const fs = new AutosaveFs();
  const session = new DocumentSession(fs.service, { autosave: true, autosaveMs: 10 });
  await session.setTarget(fs.nodeId);

  session.edit("autosaved draft");
  await delay(30);

  expect(fs.text()).toBe("autosaved draft");
  expect(session.snapshot().dirty).toBe(false);
  expect(session.snapshot().status).toBe("ready");
  session.dispose();
});
