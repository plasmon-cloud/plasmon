import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AssociationRegistry,
  FsEventSource,
  FsNode,
  FsService,
  JsonValue,
  NodeId,
  OpenService,
  ProcessController,
} from "../contracts/index.ts";
import {
  FileManager,
  FileOperationClipboard,
  type DesktopPosition,
  type FileManagerSnapshot,
} from "../file-manager/index.ts";

export const DESKTOP_PATH = "/Desktop";
export const DESKTOP_POSITIONS_METADATA_KEY = "plasmon.desktop.positions.v1";

export type DesktopPositions = Record<NodeId, DesktopPosition>;

function jsonObject(value: JsonValue | undefined): Record<string, JsonValue> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, JsonValue>
    : null;
}

export function parseDesktopPositions(value: JsonValue | undefined): DesktopPositions {
  const object = jsonObject(value);
  if (!object) return {};
  const positions: DesktopPositions = {};
  for (const [id, candidate] of Object.entries(object)) {
    const point = jsonObject(candidate);
    const x = point?.x;
    const y = point?.y;
    if (typeof x === "number" && Number.isFinite(x) && typeof y === "number" && Number.isFinite(y)) {
      positions[id] = { x, y };
    }
  }
  return positions;
}

export function defaultDesktopPosition(index: number): DesktopPosition {
  const rows = 6;
  return { x: 16 + Math.floor(index / rows) * 104, y: 16 + (index % rows) * 104 };
}

export function repositionDesktopNodes(
  current: Readonly<DesktopPositions>,
  orderedNodes: readonly FsNode[],
  ids: readonly NodeId[],
  delta: { dx: number; dy: number },
  bounds: { width: number; height: number },
): DesktopPositions {
  const next: DesktopPositions = { ...current };
  const indexById = new Map(orderedNodes.map((node, index) => [node.id, index] as const));
  const maxX = Math.max(0, bounds.width - 92);
  const maxY = Math.max(0, bounds.height - 88);
  for (const id of ids) {
    const index = indexById.get(id);
    if (index === undefined) continue;
    const origin = current[id] ?? defaultDesktopPosition(index);
    next[id] = {
      x: Math.max(0, Math.min(maxX, origin.x + delta.dx)),
      y: Math.max(0, Math.min(maxY, origin.y + delta.dy)),
    };
  }
  return next;
}

export async function ensureDesktopDirectory(fs: FsService): Promise<FsNode> {
  const existing = await fs.resolvePath(DESKTOP_PATH);
  if (existing) {
    if (existing.kind !== "directory") throw new Error(`${DESKTOP_PATH} exists but is not a directory`);
    return existing;
  }
  const root = await fs.resolvePath("/");
  if (!root || root.kind !== "directory") throw new Error("Filesystem root is unavailable");
  return fs.mkdir(root.id, "Desktop");
}

export async function readDesktopPositions(fs: FsService, desktopId: NodeId): Promise<DesktopPositions> {
  const desktop = await fs.stat(desktopId);
  return parseDesktopPositions(desktop.metadata[DESKTOP_POSITIONS_METADATA_KEY]);
}

export async function persistDesktopPositions(
  fs: FsService,
  desktopId: NodeId,
  positions: Readonly<DesktopPositions>,
): Promise<void> {
  const json: Record<string, JsonValue> = {};
  for (const [id, point] of Object.entries(positions)) json[id] = { x: point.x, y: point.y };
  await fs.setMetadata(desktopId, { [DESKTOP_POSITIONS_METADATA_KEY]: json });
}

export interface DesktopProps {
  fs: FsService;
  fsEvents?: FsEventSource;
  process: ProcessController;
  associations?: AssociationRegistry;
  openService?: OpenService;
  clipboard?: FileOperationClipboard;
  className?: string;
}

export function Desktop({
  fs,
  fsEvents,
  process,
  associations,
  openService,
  clipboard: providedClipboard,
  className,
}: DesktopProps) {
  const clipboard = useMemo(() => providedClipboard ?? new FileOperationClipboard(), [providedClipboard]);
  const [desktop, setDesktop] = useState<FsNode | null>(null);
  const [positions, setPositions] = useState<DesktopPositions>({});
  const [orderedNodes, setOrderedNodes] = useState<readonly FsNode[]>([]);
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    try {
      const node = await ensureDesktopDirectory(fs);
      const layout = parseDesktopPositions(node.metadata[DESKTOP_POSITIONS_METADATA_KEY]);
      setDesktop(node);
      setPositions(layout);
      setError(null);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [fs]);

  useEffect(() => { void initialize(); }, [initialize]);

  useEffect(() => {
    if (!fsEvents || !desktop) return undefined;
    return fsEvents.subscribe((event) => {
      if (event.type === "reset" || event.type === "changed" && event.node.id === desktop.id) {
        void readDesktopPositions(fs, desktop.id)
          .then(setPositions)
          .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)));
      }
    });
  }, [desktop, fs, fsEvents]);

  const handleSnapshot = useCallback((snapshot: FileManagerSnapshot) => {
    setOrderedNodes(snapshot.nodes);
  }, []);

  if (!desktop) {
    return (
      <section className={`plasmon-desktop${className ? ` ${className}` : ""}`} aria-label="Desktop">
        {error ? <div className="fm-error-banner" role="alert"><span>{error}</span><button type="button" onClick={() => void initialize()}>Retry</button></div> : <p className="fm-empty">Loading Desktop…</p>}
      </section>
    );
  }

  return (
    <section className={`plasmon-desktop${className ? ` ${className}` : ""}`} aria-label="Desktop">
      <FileManager
        directoryId={desktop.id}
        fs={fs}
        {...(fsEvents ? { fsEvents } : {})}
        {...(associations ? { associations } : {})}
        {...(openService ? { openService } : {})}
        process={process}
        clipboard={clipboard}
        presentation="desktop"
        positions={positions}
        onSnapshot={handleSnapshot}
        onDesktopReposition={async (ids, delta, bounds) => {
          const next = repositionDesktopNodes(positions, orderedNodes, ids, delta, bounds);
          setPositions(next);
          try {
            await persistDesktopPositions(fs, desktop.id, next);
            setError(null);
          } catch (cause: unknown) {
            setError(cause instanceof Error ? cause.message : String(cause));
          }
        }}
      />
      {error ? <div className="plasmon-desktop__notice fm-error-banner" role="alert"><span>{error}</span><button type="button" onClick={() => setError(null)}>Dismiss</button></div> : null}
    </section>
  );
}
