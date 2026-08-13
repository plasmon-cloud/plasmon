import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { FsNode, FsService } from "../../../src/os/contracts/index.ts";
import { FileEntry } from "../../../src/os/file-manager/FileEntry.tsx";
import type { InlineRenameState } from "../../../src/os/file-manager/rename.ts";

/**
 * Issue #191 RED packet.
 *
 * Existing guards intentionally remain in their owning suites:
 * - file-manager model tests: NodeId-keyed selection, F2/Enter/Escape rename
 *   policy, desktop placement, and keyboard/editable-target routing;
 * - fs desktopCore/refactorGuards/resourceOpenCrossSurface: canonical open,
 *   shortcut dereference, and identity through rename/move/Trash/recomposition;
 * - file-manager file-icons/gate3 and visual tests: resolved resource artwork,
 *   shortcut target composition, association pass-through, and thumbnail
 *   loading/revocation;
 * - desktop-label/polish-component-regression: selected/focused label overlay,
 *   rename-session selection, and context-menu ownership source guard;
 * - merged #187 packaged smoke: common Desktop rename reachability and strict
 *   browser-health ledger.
 *
 * The characterization below is deliberately small and component-level. The
 * real browser geometry correction is the companion Playwright RED gate; this
 * file must stay runnable by the ordinary Bun tool without discovering the
 * intentional RED suite.
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
