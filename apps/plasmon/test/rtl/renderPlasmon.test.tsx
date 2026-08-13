import { describe, expect, test } from "bun:test";
import { act, waitFor, within } from "@testing-library/react";
import type { ExternalElement, FsNode } from "../../src/os/contracts/index.ts";
import { renderPlasmon } from "../renderPlasmon.tsx";

const reviewElement: ExternalElement = {
  id: "review",
  name: "Review",
  description: "Collaborative review workspace.",
  version: 1,
  icon: "/app/review/icon.svg",
  tiles: [{ id: "review", title: "Review" }],
  running: "no",
};

async function requireDesktop(app: Awaited<ReturnType<typeof renderPlasmon>>): Promise<FsNode> {
  const desktop = await app.environment.node("/Desktop");
  if (!desktop || desktop.kind !== "directory") throw new Error("Desktop was not bootstrapped");
  return desktop;
}

describe("renderPlasmon", () => {
  test("drives Desktop pointer, context-menu, rename, dialog, and taskbar adapters over production services", async () => {
    const app = await renderPlasmon();

    try {
      const desktop = await requireDesktop(app);
      await act(async () => {
        await app.environment.services.fs.createFile(desktop.id, "Harness Note.txt", { mime: "text/plain" });
        await app.environment.services.fs.mkdir(desktop.id, "Harness Folder");
      });

      const note = await app.findByRole("option", { name: "Harness Note.txt" });
      await app.user.click(note);
      expect(note.getAttribute("aria-selected")).toBe("true");

      await app.user.keyboard("{F2}");
      const rename = await app.findByRole("textbox", { name: "Rename Harness Note.txt" });
      await app.user.clear(rename);
      await app.user.type(rename, "Renamed Harness Note.txt");
      await app.user.keyboard("{Enter}");

      const renamed = await app.findByRole("option", { name: "Renamed Harness Note.txt" });
      expect(await app.environment.node("/Desktop/Renamed Harness Note.txt")).not.toBeNull();

      await app.user.pointer({ target: renamed, keys: "[MouseRight]" });
      const menu = await app.findByRole("menu");
      await app.user.click(within(menu).getByRole("menuitem", { name: "Properties" }));

      const dialog = await app.findByRole("dialog");
      expect(within(dialog).getByLabelText("Properties for Renamed Harness Note.txt")).toBeDefined();
      await app.user.click(await within(dialog).findByRole("button", { name: "Close properties" }));
      await waitFor(() => expect(app.queryByRole("dialog")).toBeNull());

      const folder = await app.findByRole("option", { name: "Harness Folder" });
      await app.user.dblClick(folder);
      await waitFor(() => expect(app.environment.processes()).toHaveLength(1));
      expect(app.environment.processes()[0]?.handlerId).toBe("native:explorer");

      const taskbar = app.getByRole("navigation", { name: "Taskbar" });
      const activeFiles = await within(taskbar).findByRole("button", {
        name: /^Files; Active and focused/,
      });
      await app.user.click(activeFiles);
      await waitFor(() => expect(app.environment.windows()[0]?.minimized).toBe(true));

      const runningFiles = await within(taskbar).findByRole("button", {
        name: /^Files; Running/,
      });
      await app.user.click(runningFiles);
      await waitFor(() => expect(app.environment.windows()[0]?.minimized).toBe(false));
      await within(taskbar).findByRole("button", { name: /^Files; Active and focused/ });
    } finally {
      app.dispose();
    }
  });

  test("opens and dismisses Start through semantic user interaction", async () => {
    const app = await renderPlasmon();

    try {
      const startButton = app.getByRole("button", { name: "Start" });
      expect(startButton.getAttribute("aria-expanded")).toBe("false");

      await app.user.click(startButton);
      const start = await app.findByRole("region", { name: "Start menu" });
      expect(within(start).getByRole("textbox", { name: "Search Start" })).toBeDefined();
      expect(startButton.getAttribute("aria-expanded")).toBe("true");

      await app.user.keyboard("{Escape}");
      await waitFor(() => expect(app.queryByRole("region", { name: "Start menu" })).toBeNull());
      expect(startButton.getAttribute("aria-expanded")).toBe("false");
    } finally {
      app.dispose();
    }
  });

  test("activates a Search projection through the real filesystem/open bridge", async () => {
    const app = await renderPlasmon({ elements: [reviewElement] });

    try {
      await app.user.click(app.getByRole("button", { name: "Search" }));
      const searchRegion = app.getByRole("region", { name: "Search" });
      const searchInput = within(searchRegion).getByRole("textbox", {
        name: "Search Plasmon",
      });
      await app.user.type(searchInput, "Review");

      expect((searchInput as HTMLInputElement).value).toBe("Review");
      const description = await within(searchRegion).findByText(/Collaborative review workspace\./);
      const result = description.closest("button");
      if (!result) throw new Error("Review Search result did not render as an activation button");

      await app.user.click(result);
      await waitFor(() => {
        expect(app.environment.neutronMessages).toEqual([
          "[Plasmon preview] Open Review/review",
        ]);
      });
      expect(app.environment.processes()).toHaveLength(0);
      expect(app.environment.windows()).toHaveLength(0);
      await waitFor(() => expect(app.queryByRole("region", { name: "Search" })).toBeNull());
    } finally {
      app.dispose();
    }
  });
});
