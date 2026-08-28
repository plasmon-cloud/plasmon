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

test("#194 Start projection keeps canonical trail identity and filters only the visible snapshot", () => {
  const root = { id: "start-root", name: "Start Menu" };
  const accessories = { id: "accessories", name: "Accessories" };
  const calculator = node("calculator", "Calculator.url");
  const notes = node("notes", "Notes.txt");

  const view = projectStartSurfaceView({
    trail: [root, accessories],
    items: [calculator, notes],
    snapshotFolderId: "accessories",
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

test("#573 Start projection keeps a same-folder snapshot stable during background refresh", () => {
  const existing = node("existing", "Existing shortcut.url");
  const view = projectStartSurfaceView({
    trail: [{ id: "start-root", name: "Start Menu" }],
    items: [existing],
    snapshotFolderId: "start-root",
    query: "",
    busy: true,
    error: null,
  });

  expect(view.visibleItems).toEqual([existing]);
  expect(view.status).toEqual({ loading: false, empty: false, error: null });
});

test("#573 Start projection shows initial loading instead of a prior folder snapshot", () => {
  const prior = node("prior", "Prior shortcut.url");
  const view = projectStartSurfaceView({
    trail: [
      { id: "start-root", name: "Start Menu" },
      { id: "accessories", name: "Accessories" },
    ],
    items: [prior],
    snapshotFolderId: "start-root",
    query: "",
    busy: true,
    error: null,
  });

  expect(view.visibleItems).toEqual([]);
  expect(view.status).toEqual({ loading: true, empty: false, error: null });
});

test("#194 Start projection preserves error and empty presentation without re-entering loading", () => {
  const existing = node("existing", "Existing shortcut.url");
  const erroredRefresh = projectStartSurfaceView({
    trail: [{ id: "start-root", name: "Start Menu" }],
    items: [existing],
    snapshotFolderId: "start-root",
    query: "",
    busy: true,
    error: "filesystem unavailable",
  });
  expect(erroredRefresh.visibleItems).toEqual([existing]);
  expect(erroredRefresh.status).toEqual({
    loading: false,
    empty: false,
    error: "filesystem unavailable",
  });

  const erroredEmpty = projectStartSurfaceView({
    trail: [{ id: "start-root", name: "Start Menu" }],
    items: [],
    snapshotFolderId: "start-root",
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
    items: [existing],
    snapshotFolderId: "start-root",
    query: "missing",
    busy: false,
    error: null,
  });
  expect(filteredEmpty.visibleItems).toEqual([]);
  expect(filteredEmpty.status).toEqual({ loading: false, empty: true, error: null });
});
