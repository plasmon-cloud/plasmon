import { expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
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

test(".cmd context menu exposes the injected Transpile to .run action", () => {
  const actions: string[] = [];
  render(
    <div>
      <FileManagerContextMenu
        state={{ x: 0, y: 0, nodeId: cmdNode.id }}
        node={cmdNode}
        canOpenWith={true}
        canDownload={true}
        canTranspileCmd={true}
        canCreateShortcut={true}
        operationRunning={false}
        canPaste={false}
        onAction={(action) => actions.push(action)}
      />
    </div>,
  );
  const action = screen.getByRole("menuitem", { name: "Transpile to .run" });
  fireEvent.click(action);
  expect(actions).toContain("transpileRun");
});
