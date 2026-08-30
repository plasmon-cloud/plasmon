import { expect, test } from "bun:test";
import type { FsNode } from "../contracts/index.ts";
import { resourceArtworkMetadata } from "../fs/index.ts";
import { searchApplicationIcon, type FileSearchResult } from "./search.ts";

function gameNode(withArtwork: boolean): FsNode {
  return {
    id: "node:game",
    parentId: "node:games",
    name: "PlasmonDemo.jsdos",
    kind: "file",
    mime: "application/x-jsdos",
    size: 0,
    createdAt: 1,
    modifiedAt: 1,
    metadata: withArtwork ? resourceArtworkMetadata({
      src: "static/plasmon/artwork/plasmon-demo.svg",
      mime: "image/svg+xml",
      byteSize: 1193,
    }) : {},
  };
}

function result(node: FsNode): FileSearchResult {
  return {
    kind: "file",
    id: `node:${node.id}`,
    category: "documents",
    title: node.name,
    subtitle: node.mime ?? "Document",
    node,
  };
}

test("Search consumes the same shared thumbnail presentation as resource surfaces", () => {
  expect(searchApplicationIcon(result(gameNode(true)))).toEqual({
    kind: "thumbnail",
    src: "static/plasmon/artwork/plasmon-demo.svg",
    mediaKind: "image",
  });
});

test("Search preserves the canonical file fallback when artwork is absent", () => {
  expect(searchApplicationIcon(result(gameNode(false)))).toEqual({
    kind: "file-type",
    icon: "file",
  });
});
