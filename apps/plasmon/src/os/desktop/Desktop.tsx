import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type FileManagerOpenAuthority,
  type FileManagerSnapshot,
  type FileManagerTrashAuthority,
} from "../file-manager/index.ts";
import {
  effectiveShellWallpaper,
  SHELL_WALLPAPER_IDS,
  SHELL_WALLPAPER_LABELS,
  type ShellPreferencesAuthority,
  type ShellWallpaperId,
} from "../shell/preferences.ts";
import {
  applyDesktopDragDelta,
  applyIncomingDesktopDropPositions,
  desktopPositionsEqual,
  reconcileDesktopPositions,
  type DesktopPositions,
  type DesktopWorkspace,
} from "./layout.ts";

export const DESKTOP_PATH = "/Desktop";
export const DESKTOP_POSITIONS_METADATA_KEY = "plasmon.desktop.positions.v1";
export {
  allocateDesktopPositions,
  defaultDesktopPosition,
  reconcileDesktopPositions,
  repositionDesktopNodes,
} from "./layout.ts";
export type { DesktopPositions, DesktopWorkspace } from "./layout.ts";

function jsonObject(value: JsonValue | undefined): Record<string, JsonValue> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, JsonValue>
    : null;
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
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
  openAuthority: FileManagerOpenAuthority;
  trashAuthority: FileManagerTrashAuthority;
  fsEvents?: FsEventSource;
  process: ProcessController;
  shellPreferences: ShellPreferencesAuthority;
  associations?: AssociationRegistry;
  openService?: OpenService;
  clipboard?: FileOperationClipboard;
  className?: string;
}

export function Desktop({
  fs,
  openAuthority,
  trashAuthority,
  fsEvents,
  process,
  shellPreferences,
  associations,
  openService,
  clipboard: providedClipboard,
  className,
}: DesktopProps) {
  const clipboard = useMemo(() => providedClipboard ?? new FileOperationClipboard(), [providedClipboard]);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const activeIdsRef = useRef<readonly NodeId[]>([]);
  const [desktop, setDesktop] = useState<FsNode | null>(null);
  const [positions, setPositions] = useState<DesktopPositions>({});
  const [orderedIds, setOrderedIds] = useState<readonly NodeId[]>([]);
  const [incumbentIds, setIncumbentIds] = useState<readonly NodeId[]>([]);
  const [workspace, setWorkspace] = useState<DesktopWorkspace | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    try {
      const node = await ensureDesktopDirectory(fs);
      const layout = parseDesktopPositions(node.metadata[DESKTOP_POSITIONS_METADATA_KEY]);
      setDesktop(node);
      setPositions(layout);
      setError(null);
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    }
  }, [fs]);

  useEffect(() => { void initialize(); }, [initialize]);

  useEffect(() => {
    const element = workspaceRef.current;
    if (!element) return undefined;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      setWorkspace((current) => current?.width === rect.width && current.height === rect.height
        ? current
        : { width: rect.width, height: rect.height });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!fsEvents || !desktop) return undefined;
    return fsEvents.subscribe((event) => {
      if (event.type === "reset" || event.type === "changed" && event.node.id === desktop.id) {
        void readDesktopPositions(fs, desktop.id)
          .then(setPositions)
          .catch((cause: unknown) => setError(errorMessage(cause)));
      }
    });
  }, [desktop, fs, fsEvents]);

  const resolvedPositions = useMemo(
    () => reconcileDesktopPositions(positions, orderedIds, workspace, incumbentIds),
    [incumbentIds, orderedIds, positions, workspace],
  );

  useEffect(() => {
    if (!desktop || orderedIds.length === 0 || desktopPositionsEqual(positions, resolvedPositions)) return;
    setPositions(resolvedPositions);
    void persistDesktopPositions(fs, desktop.id, resolvedPositions)
      .then(() => setError(null))
      .catch((cause: unknown) => setError(errorMessage(cause)));
  }, [desktop, fs, orderedIds.length, positions, resolvedPositions]);

  const handleSnapshot = useCallback((snapshot: FileManagerSnapshot) => {
    const nextIds = snapshot.nodes.map((node) => node.id);
    const previousIds = activeIdsRef.current;
    if (previousIds.length === nextIds.length && previousIds.every((id, index) => id === nextIds[index])) return;
    setIncumbentIds(previousIds);
    activeIdsRef.current = nextIds;
    setOrderedIds(nextIds);
  }, []);

  const sectionClassName = `plasmon-desktop${className ? ` ${className}` : ""}`;

  if (!desktop) {
    return (
      <section ref={workspaceRef} className={sectionClassName} aria-label="Desktop">
        {error ? (
          <div className="fm-error-banner" role="alert">
            <span>{error}</span>
            <div className="fm-error-banner__actions">
              <button type="button" onClick={() => setError(null)}>Dismiss</button>
              <button type="button" onClick={() => void initialize()}>Retry</button>
            </div>
          </div>
        ) : <p className="fm-empty">Loading Desktop…</p>}
      </section>
    );
  }

  return (
    <section ref={workspaceRef} className={sectionClassName} aria-label="Desktop">
      <FileManager
        directoryId={desktop.id}
        fs={fs}
        openAuthority={openAuthority}
        trashAuthority={trashAuthority}
        {...(fsEvents ? { fsEvents } : {})}
        {...(associations ? { associations } : {})}
        {...(openService ? { openService } : {})}
        process={process}
        clipboard={clipboard}
        presentation="desktop"
        positions={resolvedPositions}
        desktopWallpaperMenu={{
          get choices() {
            const snapshot = shellPreferences.getSnapshot();
            const active = effectiveShellWallpaper(snapshot.themeId, snapshot.wallpaper);
            return SHELL_WALLPAPER_IDS.map((id) => ({
              id,
              label: SHELL_WALLPAPER_LABELS[id],
              selected: active === id,
            }));
          },
          get disabled() { return !shellPreferences.isReady(); },
          async onSelect(id) {
            try {
              const outcome = await shellPreferences.save({
                ...shellPreferences.getSnapshot(),
                wallpaper: { mode: "pinned", id: id as ShellWallpaperId },
              });
              if (!outcome.saved) throw outcome.error;
              setError(null);
            } catch (cause: unknown) {
              setError(`Wallpaper preference could not be saved: ${errorMessage(cause)}`);
            }
          },
        }}
        onSnapshot={handleSnapshot}
        onIncomingDropPlacement={async (intent) => {
          const next = applyIncomingDesktopDropPositions(
            resolvedPositions,
            orderedIds,
            intent.placements,
            intent.workspace,
          );
          try {
            await persistDesktopPositions(fs, desktop.id, next);
            setPositions(next);
            setError(null);
          } catch (cause: unknown) {
            setError(errorMessage(cause));
            throw cause;
          }
        }}
        onDesktopReposition={async (ids, delta, bounds) => {
          const candidates = applyDesktopDragDelta(resolvedPositions, orderedIds, ids, delta, bounds);
          const movedIds = new Set(ids);
          const stationaryIds = orderedIds.filter((id) => !movedIds.has(id));
          const next = reconcileDesktopPositions(candidates, orderedIds, bounds, stationaryIds);
          setPositions(next);
          try {
            await persistDesktopPositions(fs, desktop.id, next);
            setError(null);
          } catch (cause: unknown) {
            setError(errorMessage(cause));
          }
        }}
      />
      {error ? (
        <div className="plasmon-desktop__notice fm-error-banner" role="alert">
          <span>{error}</span><button type="button" onClick={() => setError(null)}>Dismiss</button>
        </div>
      ) : null}
    </section>
  );
}
