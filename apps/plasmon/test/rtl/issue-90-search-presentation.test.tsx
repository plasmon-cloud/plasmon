import { expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import type { ExternalElement, FsNode } from "../../src/os/contracts/index.ts";
import { SearchSurface } from "../../src/os/shell/SearchSurface.tsx";
import type { NeutronProjectionSearchResult } from "../../src/os/shell/search.ts";
import type { SearchSurfaceController } from "../../src/os/shell/use-search-surface-controller.ts";

function projectionNode(): FsNode {
  return {
    id: "projection-review",
    parentId: "apps",
    name: "Review.neutron",
    kind: "file",
    size: 0,
    createdAt: 1,
    modifiedAt: 1,
    metadata: {},
  };
}

function controller(results: SearchSurfaceController["view"]["results"]): SearchSurfaceController {
  return {
    query: "review",
    setQuery() {},
    tab: "apps",
    setTab() {},
    view: {
      results,
      searching: false,
      error: null,
      empty: false,
      warnings: [],
      truncated: false,
      capped: false,
    },
  };
}

test("SearchSurface renders canonical Neutron application presentation without runtime/package tokens", () => {
  const node = projectionNode();
  const projection: NeutronProjectionSearchResult = {
    kind: "neutron-projection",
    id: "element:review",
    category: "apps",
    title: "Review",
    subtitle: "Collaborative reviews",
    elementId: "review",
    node,
  };

  const view = render(
    <SearchSurface
      controller={controller([projection])}
      searchMark={<span>Search</span>}
      activationBusyId={null}
      resolveShortcutPresentation={() => ({})}
      onActivate={async () => undefined}
    />,
  );

  try {
    const result = view.getByRole("button", { name: /Review/i });
    expect(result.textContent).toContain("Review");
    expect(result.textContent).toContain("Collaborative reviews");
    expect(result.textContent).not.toContain("Review.neutron");
    expect(result.textContent).not.toMatch(/running|runtime status|stopped/iu);

    // The application remains accessible by canonical identity even with no supplied icon.
    expect(result.getAttribute("aria-label")).toBeNull();
    expect(node.id).toBe("projection-review");
    expect(node.name).toBe("Review.neutron");
  } finally {
    cleanup();
  }
});

test("SearchSurface keeps direct Element and projection presentation consistent without runtime state", () => {
  const element: ExternalElement = {
    id: "mail",
    name: "Mail",
    description: "Canonical Neutron Mail",
    icon: "mail-icon",
    tiles: [{ id: "main", title: "Mail" }],
    running: "yes",
  };
  const direct = {
    kind: "element" as const,
    id: "element:mail",
    category: "apps" as const,
    title: "Mail",
    subtitle: "Canonical Neutron Mail",
    element,
  };
  const projection: NeutronProjectionSearchResult = {
    kind: "neutron-projection",
    id: "element:mail-projection",
    category: "apps",
    title: direct.title,
    subtitle: direct.subtitle,
    icon: element.icon,
    elementId: element.id,
    node: {
      ...projectionNode(),
      id: "projection-mail",
      name: "Mail.neutron",
    },
  };

  const view = render(
    <SearchSurface
      controller={controller([direct, projection])}
      searchMark={<span>Search</span>}
      activationBusyId={null}
      resolveShortcutPresentation={() => ({})}
      onActivate={async () => undefined}
    />,
  );

  try {
    const results = view.getAllByRole("button", { name: /Mail/i });
    expect(results).toHaveLength(2);
    for (const result of results) {
      expect(result.textContent).toContain("Mail");
      expect(result.textContent).toContain("Canonical Neutron Mail");
      expect(result.textContent).not.toMatch(/running|runtime status|stopped/iu);
      expect(result.textContent).not.toContain(".neutron");
    }
  } finally {
    cleanup();
  }
});
