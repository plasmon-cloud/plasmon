import { afterEach, expect, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { FsNode } from "../../src/os/contracts/index.ts";
import { StartSurface, type StartItemPresentation } from "../../src/os/shell/StartSurface.tsx";
import { projectStartSurfaceView } from "../../src/os/shell/start-surface-state.ts";

afterEach(() => cleanup());

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

function presentation(item: FsNode): StartItemPresentation {
  return {
    shortcut: item.kind === "file",
    subtitle: item.kind === "directory" ? "Folder" : "Shortcut · native",
    ...(item.kind === "file" ? {
      context: { kind: "native" as const, id: "text" },
      pin: { kind: "native" as const, id: "text", label: "Pin to taskbar", pinned: false },
    } : {}),
  };
}

test("#194 focused Start surface keeps loading, error, and the filesystem snapshot visible together", () => {
  const existing = node("existing", "Existing.url");
  const screen = render(<StartSurface
    view={projectStartSurfaceView({
      trail: [{ id: "start-root", name: "Start Menu" }],
      items: [existing],
      query: "",
      busy: true,
      error: "refresh failed",
    })}
    busyId={null}
    preferencesReady
    presentItem={presentation}
    onQueryChange={() => {}}
    onSearchEverywhere={() => {}}
    onBack={() => {}}
    onOpen={() => {}}
    onPin={() => {}}
    onSettings={() => {}}
  />);

  expect(screen.getByRole("alert").textContent).toContain("refresh failed");
  expect(screen.getByRole("status").textContent).toContain("Loading Start Menu");
  expect(screen.getByRole("button", { name: /Existing\.url/ })).toBeTruthy();
});

test("#194 focused Start surface translates query, navigation, activation, pin, settings, and keyboard intent", () => {
  const folder = node("folder", "Accessories", "directory");
  const shortcut = node("shortcut", "Text.url");
  const calls: string[] = [];
  const screen = render(<StartSurface
    view={projectStartSurfaceView({
      trail: [
        { id: "start-root", name: "Start Menu" },
        { id: "nested", name: "Nested" },
      ],
      items: [folder, shortcut],
      query: "text",
      busy: false,
      error: null,
    })}
    busyId={null}
    preferencesReady
    presentItem={presentation}
    onQueryChange={(query) => calls.push(`query:${query}`)}
    onSearchEverywhere={(query) => calls.push(`search:${query}`)}
    onBack={() => calls.push("back")}
    onOpen={(item) => calls.push(`open:${item.id}`)}
    onPin={(kind, id) => calls.push(`pin:${kind}:${id}`)}
    onSettings={() => calls.push("settings")}
  />);

  const input = screen.getByRole("textbox", { name: "Search Start" });
  fireEvent.change(input, { target: { value: "notes" } });
  fireEvent.keyDown(input, { key: "Enter" });
  fireEvent.click(screen.getByRole("button", { name: "← Back" }));
  fireEvent.click(screen.getByRole("button", { name: /Text\.url/ }));
  fireEvent.click(screen.getByRole("button", { name: "Pin to taskbar" }));
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));

  expect(calls).toEqual([
    "query:notes",
    "search:text",
    "back",
    "open:shortcut",
    "pin:native:text",
    "settings",
  ]);

  const item = screen.getByRole("button", { name: /Text\.url/ });
  item.focus();
  fireEvent.keyDown(item.closest(".plasmon-shell__list")!, { key: "Home" });
  expect(document.activeElement).toBe(item);
});
