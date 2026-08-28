import type { FsNode, NodeId } from "../contracts/index.ts";

export interface StartTrailItem {
  id: NodeId;
  name: string;
}

export interface StartSurfaceStatus {
  loading: boolean;
  empty: boolean;
  error: string | null;
}

export interface StartSurfaceViewState {
  folderId: NodeId | null;
  trail: readonly StartTrailItem[];
  trailLabel: string;
  canGoBack: boolean;
  query: string;
  visibleItems: readonly FsNode[];
  status: StartSurfaceStatus;
}

export interface StartSurfaceViewInput {
  trail: readonly StartTrailItem[];
  items: readonly FsNode[];
  query: string;
  busy: boolean;
  error: string | null;
}

export function projectStartSurfaceView(input: StartSurfaceViewInput): StartSurfaceViewState {
  const needle = input.query.trim().toLocaleLowerCase();
  const visibleItems = needle
    ? input.items.filter((node) => node.name.toLocaleLowerCase().includes(needle))
    : [...input.items];
  const currentFolder = input.trail.at(-1) ?? null;

  return {
    folderId: currentFolder?.id ?? null,
    trail: [...input.trail],
    trailLabel: input.trail.map((item) => item.name).join(" / ") || "Start Menu",
    canGoBack: input.trail.length > 1,
    query: input.query,
    visibleItems,
    status: {
      loading: input.busy,
      empty: !input.busy && visibleItems.length === 0,
      error: input.error,
    },
  };
}
