import { expect, test } from "bun:test";
import type { CreateFileOptions, FsNode, FsService, NodeId } from "../contracts/index.ts";
import { classifyResource } from "../fs/resourcePolicy.ts";
import { createDocument } from "./create-import.ts";
import { renameNode } from "./model.ts";

function generatedNode(parentId: NodeId, name: string, options?: CreateFileOptions): FsNode {
  return {
    id: "generated-document",
    parentId,
    name,
    kind: options?.kind ?? "file",
    size: 0,
    createdAt: 1,
    modifiedAt: 1,
    metadata: options?.metadata ?? {},
    ...(options?.mime ? { mime: options.mime } : {}),
  };
}

test("generated text documents remain filename-derived across a .txt -> .js rename", async () => {
  let current: FsNode | null = null;
  const fs = {
    list: async () => [],
    createFile: async (parentId: NodeId, name: string, options?: CreateFileOptions) => {
      current = generatedNode(parentId, name, options);
      return structuredClone(current);
    },
    rename: async (id: NodeId, newName: string) => {
      if (!current || current.id !== id) throw new Error(`Unknown node: ${id}`);
      current = { ...current, name: newName, modifiedAt: current.modifiedAt + 1 };
      return structuredClone(current);
    },
  } as unknown as FsService;

  const created = await createDocument(fs, "documents", "text");
  expect(created.name).toBe("New Text Document.txt");
  expect(created.mime).toBeUndefined();
  expect(classifyResource(created).type).toMatchObject({
    source: "filename",
    language: "plaintext",
    mime: "text/plain",
  });

  const renamed = await renameNode(fs, created.id, "test.js");
  expect(renamed.id).toBe(created.id);
  expect(renamed.mime).toBeUndefined();
  expect(classifyResource(renamed).type).toMatchObject({
    source: "filename",
    language: "javascript",
    mime: "application/javascript",
  });
});
