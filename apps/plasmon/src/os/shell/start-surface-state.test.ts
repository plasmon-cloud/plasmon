import { expect, test } from "bun:test";
import type { FsNode } from "../contracts/index.ts";
import { projectStartSurfaceView } from "./start-surface-state.ts";

function node(id: string, name: string, kind: "file" | "directory" = "file"): FsNode {
  return {
    id,
    name,
    kind,
    parentId: "start-root",
    createdAt: 1,
    updatedAt: 1,
    ...(kind === "file" ? { size: 0, mime: "text/plain", contentHash: "" } : {}),
  } as FsNode;
}

test("Start projection keeps canonical trail identity and filters only the visible snapshot", () => {
  const root = { id: "start-root", name: "Start Menu" };
  const accessories = { id: "accessories", name: "Accessories" };
  const calculator = node("calculator", "Calculator.url");
  const notes = node("notes", "Notes.txt");

  const view = projectStartSurfaceView({
    trail: [root, accessories],
    items: [calculator, notes],
    query: " calc ",
    busy: false,
    error: null,
  });

  expect(view.folderId).toBe("accessories");
  expect(view.trail).toEqual([root, accessories]);
  expect(view.trailLabel).toBe("Start Menu / Accessories");
  expect(view.canGoBack).toBe(true);
  expect(view.query).toBe(" calc ");
  expect(view.visibleItems.map((item) => item.id)).toEqual(["calculator"]);
  expect(view.status).toEqual({ loading: false, empty: false, error: null });
});

test("Start projection preserves the last filesystem snapshot while loading", () => {
  const stale = node("stale", "Existing shortcut.url");
  const view = projectStartSurfaceView({
    trail: [{ id: "start-root", name: "Start Menu" }],
    items: [stale],
    query: "",
    busy: true,
    error: null,
  });

  expect(view.visibleItems).toEqual([stale]);
  expect(view.status).toEqual({ loading: true, empty: false, error: null });
});

test("Start projection preserves independent error, loading, and empty presentation", () => {
  const stale = node("stale", "Existing shortcut.url");
  const erroredLoading = projectStartSurfaceView({
    trail: [{ id: "start-root", name: "Start Menu" }],
    items: [stale],
    query: "",
    busy: true,
    error: "filesystem unavailable",
  });
  expect(erroredLoading.visibleItems).toEqual([stale]);
  expect(erroredLoading.status).toEqual({
    loading: true,
    empty: false,
    error: "filesystem unavailable",
  });

  const erroredEmpty = projectStartSurfaceView({
    trail: [{ id: "start-root", name: "Start Menu" }],
    items: [],
    query: "",
    busy: false,
    error: "filesystem unavailable",
  });
  expect(erroredEmpty.status).toEqual({
    loading: false,
    empty: true,
    error: "filesystem unavailable",
  });

  const filteredEmpty = projectStartSurfaceView({
    trail: [{ id: "start-root", name: "Start Menu" }],
    items: [stale],
    query: "missing",
    busy: false,
    error: null,
  });
  expect(filteredEmpty.visibleItems).toEqual([]);
  expect(filteredEmpty.status).toEqual({ loading: false, empty: true, error: null });
});
