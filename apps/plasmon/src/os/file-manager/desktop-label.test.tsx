// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { FsNode, FsService } from "../contracts/index.ts";
import { FileEntry } from "./FileEntry.tsx";
import type { InlineRenameState } from "./rename.ts";

const LONG_NAME = "Quarterly planning notes with a deliberately long desktop filename.txt";

const node: FsNode = {
  id: "long-file",
  parentId: "desktop",
  name: LONG_NAME,
  kind: "file",
  mime: "text/plain",
  size: 12,
  createdAt: 1,
  modifiedAt: 1,
  metadata: {},
};

const fs = {} as FsService;

function renderDesktopEntry(options: {
  selected?: boolean;
  focused?: boolean;
  rename?: InlineRenameState | null;
} = {}): string {
  return renderToStaticMarkup(
    <FileEntry
      fs={fs}
      node={node}
      selected={options.selected ?? false}
      focused={options.focused ?? false}
      presentation="desktop"
      position={{ x: 16, y: 24 }}
      rename={options.rename ?? null}
      setRef={() => undefined}
      onPointerDown={() => undefined}
      onPointerMove={() => undefined}
      onPointerUp={() => undefined}
      onPointerCancel={() => undefined}
      onDoubleClick={() => undefined}
      onContextMenu={() => undefined}
      onRenameChange={() => undefined}
      onRenameCommit={() => undefined}
      onRenameCancel={() => undefined}
    />,
  );
}

test("unselected Desktop filename keeps only the compact label", () => {
  const markup = renderDesktopEntry();
  expect(markup).not.toContain("fm-entry__expanded-name");
  expect(markup).toContain(`title="${LONG_NAME}"`);
  expect(markup).toContain("--fm-desktop-entry-x:16px");
});

test("selected or focused Desktop filename adds one pointer-independent visual overlay", () => {
  const selected = renderDesktopEntry({ selected: true });
  const focused = renderDesktopEntry({ focused: true });
  expect(selected).toContain("fm-entry__expanded-name");
  expect(focused).toContain("fm-entry__expanded-name");
  expect(selected).toContain("aria-hidden=\"true\"");
});

test("inline rename replaces the read-only expanded label instead of duplicating it", () => {
  const rename: InlineRenameState = {
    nodeId: node.id,
    value: LONG_NAME,
    initialName: LONG_NAME,
    session: 1,
    error: null,
    busy: false,
  };
  const markup = renderDesktopEntry({ selected: true, focused: true, rename });
  expect(markup).not.toContain("fm-entry__expanded-name");
  expect(markup).toContain(`aria-label="Rename ${LONG_NAME}"`);
});
