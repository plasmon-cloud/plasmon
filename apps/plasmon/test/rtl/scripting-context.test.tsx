import { afterEach, expect, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import type { FsNode } from "../../src/os/contracts/index.ts";
import { FileManagerContextMenu } from "../../src/os/file-manager/FileManagerContextMenu.tsx";

const cmdNode: FsNode = {
  id: "file:cmd",
  parentId: "dir:documents",
  name: "demo.cmd",
  kind: "file",
  mime: "application/x-sh",
  size: 10,
  createdAt: 1,
  modifiedAt: 1,
  metadata: {},
};

const runNode: FsNode = {
  ...cmdNode,
  id: "file:run",
  name: "demo.run",
  mime: "application/typescript",
};

function renderMenu(node: FsNode | null, overrides: Partial<ComponentProps<typeof FileManagerContextMenu>> = {}) {
  const actions: string[] = [];
  render(
    <div>
      <FileManagerContextMenu
        state={{ x: 0, y: 0, nodeId: node?.id ?? null }}
        node={node}
        canOpenWith={true}
        canDownload={true}
        canTranspileCmd={node?.name.toLowerCase().endsWith(".cmd") ?? false}
        canRunScript={node?.name.toLowerCase().endsWith(".cmd") || node?.name.toLowerCase().endsWith(".run") || false}
        canEditScript={true}
        canCreateShortcut={true}
        operationRunning={false}
        canPaste={false}
        onAction={(action) => actions.push(action)}
        {...overrides}
      />
    </div>,
  );
  return actions;
}

afterEach(cleanup);

test(".cmd context menu exposes Run, Edit, and Transpile to .run", () => {
  const actions = renderMenu(cmdNode);
  expect(screen.queryByRole("menuitem", { name: "Open", exact: true })).toBeNull();

  fireEvent.click(screen.getByRole("menuitem", { name: "Run", exact: true }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Edit", exact: true }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Transpile to .run", exact: true }));

  expect(actions).toEqual(["runScript", "editScript", "transpileRun"]);
});

test(".run context menu is executable/editable but does not offer transpilation", () => {
  const actions = renderMenu(runNode);
  expect(screen.getByRole("menuitem", { name: "Run", exact: true })).toBeTruthy();
  expect(screen.getByRole("menuitem", { name: "Edit", exact: true })).toBeTruthy();
  expect(screen.queryByRole("menuitem", { name: "Transpile to .run", exact: true })).toBeNull();

  fireEvent.click(screen.getByRole("menuitem", { name: "Run", exact: true }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Edit", exact: true }));
  expect(actions).toEqual(["runScript", "editScript"]);
});

test("Edit is disabled when the script editor authority is unavailable", () => {
  const actions = renderMenu(cmdNode, { canEditScript: false });
  const edit = screen.getByRole("menuitem", { name: "Edit", exact: true });
  expect((edit as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(edit);
  expect(actions).toEqual([]);
});

test("ordinary non-script resources retain Open instead of Run/Edit", () => {
  const actions = renderMenu({ ...cmdNode, id: "file:text", name: "notes.txt", mime: "text/plain" }, {
    canRunScript: false,
    canTranspileCmd: false,
  });
  expect(screen.queryByRole("menuitem", { name: "Run", exact: true })).toBeNull();
  expect(screen.queryByRole("menuitem", { name: "Edit", exact: true })).toBeNull();
  fireEvent.click(screen.getByRole("menuitem", { name: "Open", exact: true }));
  expect(actions).toEqual(["open"]);
});

test("background menu creates both command and run scripts explicitly", () => {
  const actions = renderMenu(null);
  fireEvent.click(screen.getByRole("menuitem", { name: "New", exact: true }));
  fireEvent.click(screen.getByRole("menuitem", { name: "New Command Script (.cmd)", exact: true }));
  fireEvent.click(screen.getByRole("menuitem", { name: "New", exact: true }));
  fireEvent.click(screen.getByRole("menuitem", { name: "New Run Script (.run)", exact: true }));
  expect(actions).toEqual(["newCmd", "newRun"]);
});
