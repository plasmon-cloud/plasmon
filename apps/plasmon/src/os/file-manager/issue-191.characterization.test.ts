import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { FsNode, FsService } from "../contracts/index.ts";
import { FileEntry } from "./FileEntry.tsx";
import type { InlineRenameState } from "./rename.ts";

/**
 * Adopted from Luna TDD-A's #191 RED packet.
 *
 * Existing guards remain in their owning suites. This characterization stays
 * deliberately component-level while the real geometry correction is covered
 * by the companion packaged Playwright regression.
 */
const node: FsNode = {
  id: "issue-191-node",
  parentId: "desktop",
  name: "Issue 191.txt",
  kind: "file",
  mime: "text/plain",
  size: 0,
  createdAt: 1,
  modifiedAt: 1,
  metadata: {},
};

const fs = {} as FsService;

function renderEntry(options: {
  selected?: boolean;
  focused?: boolean;
  rename?: InlineRenameState | null;
} = {}): string {
  return renderToStaticMarkup(createElement(FileEntry, {
    fs,
    node,
    selected: options.selected ?? false,
    focused: options.focused ?? false,
    presentation: "desktop",
    position: { x: 16, y: 24 },
    rename: options.rename ?? null,
    setRef: () => undefined,
    onPointerDown: () => undefined,
    onPointerMove: () => undefined,
    onPointerUp: () => undefined,
    onPointerCancel: () => undefined,
    onDoubleClick: () => undefined,
    onContextMenu: () => undefined,
    onRenameChange: () => undefined,
    onRenameCommit: () => undefined,
    onRenameCancel: () => undefined,
  }));
}

test("#191 characterization keeps FileEntry selection and rename state keyed to NodeId", () => {
  const selected = renderEntry({ selected: true, focused: true });
  expect(selected).toContain('role="option"');
  expect(selected).toContain('aria-selected="true"');
  expect(selected).toContain('data-fm-node-id="issue-191-node"');
  expect(selected).toContain("is-focused");

  const rename: InlineRenameState = {
    nodeId: node.id,
    value: node.name,
    initialName: node.name,
    session: 1,
    error: null,
    busy: false,
  };
  const editing = renderEntry({ selected: true, focused: true, rename });
  expect(editing).toContain(`aria-label="Rename ${node.name}"`);
  expect(editing).not.toContain("fm-entry__expanded-name");
});