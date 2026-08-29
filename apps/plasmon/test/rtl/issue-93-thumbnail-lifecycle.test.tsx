import { expect, test } from "bun:test";
import { act, render, waitFor } from "@testing-library/react";
import { useRef } from "react";
import type { FsNode, FsService } from "../../src/os/contracts/index.ts";
import { useResourceThumbnail } from "../../src/os/use-resource-thumbnail.ts";

function imageNode(id: string, name: string): FsNode {
  return {
    id,
    parentId: "root",
    name,
    kind: "file",
    mime: "image/png",
    size: 4,
    createdAt: 0,
    modifiedAt: 0,
    contentHash: null,
    metadata: {},
  };
}

function ThumbnailHarness({ fs, node }: { fs: FsService; node: FsNode }) {
  const entryRef = useRef<HTMLDivElement | null>(null);
  const thumbnail = useResourceThumbnail(fs, node, entryRef);
  return <div ref={entryRef} data-thumbnail={thumbnail ?? ""} />;
}

test("thumbnail lifecycle stays lazy and revokes loaded URLs on replacement/unmount", async () => {
  const originalIntersectionObserver = globalThis.IntersectionObserver;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  let callback: IntersectionObserverCallback | null = null;
  let observer: IntersectionObserver | null = null;
  const readIds: string[] = [];
  const revoked: string[] = [];
  let nextUrl = 1;

  class ControlledIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "96px";
    readonly thresholds = [0];

    constructor(nextCallback: IntersectionObserverCallback) {
      callback = nextCallback;
      observer = this;
    }

    disconnect() {}
    observe() {}
    takeRecords(): IntersectionObserverEntry[] { return []; }
    unobserve() {}
  }

  const emitIntersection = (isIntersecting: boolean) => {
    if (!callback || !observer) throw new Error("thumbnail observer was not installed");
    callback([
      { isIntersecting } as IntersectionObserverEntry,
    ], observer);
  };

  const fs = {
    async read(nodeId: string) {
      readIds.push(nodeId);
      return Uint8Array.from([137, 80, 78, 71]);
    },
  } as unknown as FsService;

  try {
    globalThis.IntersectionObserver = ControlledIntersectionObserver;
    URL.createObjectURL = () => `blob:issue-93-${nextUrl++}`;
    URL.revokeObjectURL = (url) => { revoked.push(url); };

    const first = imageNode("image-1", "portrait.png");
    const second = imageNode("image-2", "landscape.png");
    const rendered = render(<ThumbnailHarness fs={fs} node={first} />);

    await act(async () => { await Promise.resolve(); });
    expect(readIds).toEqual([]);

    act(() => emitIntersection(false));
    await act(async () => { await Promise.resolve(); });
    expect(readIds).toEqual([]);

    act(() => emitIntersection(true));
    await waitFor(() => {
      expect(readIds).toEqual(["image-1"]);
      expect(rendered.container.firstElementChild?.getAttribute("data-thumbnail"))
        .toBe("blob:issue-93-1");
    });

    rendered.rerender(<ThumbnailHarness fs={fs} node={second} />);
    await waitFor(() => expect(revoked).toEqual(["blob:issue-93-1"]));
    expect(readIds).toEqual(["image-1"]);

    act(() => emitIntersection(true));
    await waitFor(() => {
      expect(readIds).toEqual(["image-1", "image-2"]);
      expect(rendered.container.firstElementChild?.getAttribute("data-thumbnail"))
        .toBe("blob:issue-93-2");
    });

    rendered.unmount();
    expect(revoked).toEqual(["blob:issue-93-1", "blob:issue-93-2"]);
  } finally {
    globalThis.IntersectionObserver = originalIntersectionObserver;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  }
});
