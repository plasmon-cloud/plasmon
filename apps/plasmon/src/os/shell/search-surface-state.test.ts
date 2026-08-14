import { describe, expect, test } from "bun:test";
import type { FsNode } from "../contracts/index.ts";
import { deriveSearchSurfaceViewState } from "./search-surface-state.ts";
import type { SearchBatch, ShellSearchResult } from "./search.ts";

function node(id: string, name: string): FsNode {
  return {
    id,
    parentId: "root",
    name,
    kind: "file",
    mime: "text/plain",
    size: 0,
    createdAt: 1,
    modifiedAt: 1,
    metadata: {},
  };
}

function result(id: string, category: "documents" | "media"): ShellSearchResult {
  const resource = node(`node-${id}`, id);
  return {
    kind: "file",
    id,
    category,
    title: resource.name,
    subtitle: resource.mime ?? "Document",
    node: resource,
  };
}

describe("Search surface view state", () => {
  test("projects canonical results through the selected category without changing result identity", () => {
    const document = result("notes.txt", "documents");
    const media = result("photo.png", "media");
    const batch: SearchBatch = {
      results: [document, media],
      warnings: ["partial directory unavailable"],
      truncated: true,
    };

    const view = deriveSearchSurfaceViewState({
      batch,
      tab: "documents",
      searching: false,
      error: null,
    });

    expect(view.results).toEqual([document]);
    expect(view.results[0]).toBe(document);
    expect(view.warnings).toEqual(["partial directory unavailable"]);
    expect(view.truncated).toBe(true);
    expect(view.empty).toBe(false);
  });

  test("keeps loading, error, and empty presentation state explicit", () => {
    const empty: SearchBatch = { results: [], warnings: [], truncated: false };

    expect(deriveSearchSurfaceViewState({
      batch: empty,
      tab: "all",
      searching: true,
      error: null,
    })).toMatchObject({ searching: true, error: null, empty: false });

    expect(deriveSearchSurfaceViewState({
      batch: empty,
      tab: "all",
      searching: false,
      error: "Search failed",
    })).toMatchObject({ searching: false, error: "Search failed", empty: false });

    expect(deriveSearchSurfaceViewState({
      batch: empty,
      tab: "all",
      searching: false,
      error: null,
    })).toMatchObject({ searching: false, error: null, empty: true });
  });

  test("does not expose stale results or batch warnings while the current request is in error", () => {
    const stale = result("stale.txt", "documents");
    const batch: SearchBatch = {
      results: [stale],
      warnings: ["stale warning"],
      truncated: true,
    };

    expect(deriveSearchSurfaceViewState({
      batch,
      tab: "all",
      searching: false,
      error: "Search failed",
    })).toEqual({
      results: [],
      searching: false,
      error: "Search failed",
      empty: false,
      warnings: [],
      truncated: false,
    });
  });
});
