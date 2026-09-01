import { expect, test } from "bun:test";
import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileManagerCommandBar } from "../../src/os/file-manager/FileManagerCommandBar.tsx";

test("FileManager command bar omits redundant permanent creation buttons and preserves the remaining commands", async () => {
  const user = userEvent.setup();
  let refreshes = 0;
  const noOp = () => {};
  const view = render(
    <FileManagerCommandBar
      selectionCount={1}
      canCreateShortcut={true}
      canPaste={true}
      operationRunning={false}
      onNewFolder={noOp}
      onNewText={noOp}
      onNewMarkdown={noOp}
      onImport={noOp}
      onCopy={noOp}
      onCut={noOp}
      onCreateShortcut={noOp}
      onSendToDesktop={noOp}
      onPaste={noOp}
      onDelete={noOp}
      onRefresh={() => { refreshes += 1; }}
    />,
  );

  const toolbar = within(view.getByRole("toolbar", { name: "File commands" }));
  expect(toolbar.queryByRole("button", { name: "New Folder" })).toBeNull();
  expect(toolbar.queryByRole("button", { name: "New Text Document" })).toBeNull();
  expect(toolbar.queryByRole("button", { name: "New Markdown Document" })).toBeNull();
  expect(toolbar.getAllByRole("button").map((button) => button.textContent)).toEqual([
    "Import Files…",
    "Copy",
    "Cut",
    "Create Shortcut",
    "Send to Desktop",
    "Paste",
    "Delete",
    "Refresh",
  ]);

  await user.click(toolbar.getByRole("button", { name: "Refresh" }));
  expect(refreshes).toBe(1);

  view.unmount();
});
