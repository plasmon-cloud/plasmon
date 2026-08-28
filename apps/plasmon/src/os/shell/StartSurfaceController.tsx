import { useEffect, useMemo, useState } from "react";
import type { FsNode, FsService } from "../contracts/index.ts";
import type { HiddenVisibilityPreferenceStore } from "../hiddenVisibility.ts";
import { StartSurface, type StartItemPresentation } from "./StartSurface.tsx";
import type { StartMenuReconciliationController } from "./start-menu-reconciliation-controller.ts";
import { projectStartSurfaceView, type StartTrailItem } from "./start-surface-state.ts";
import { listVisibleStartMenuFolder } from "./startVisibility.ts";

export interface StartSurfaceControllerProps {
  active: boolean;
  fs: FsService;
  reconciliation: StartMenuReconciliationController;
  hiddenVisibility: HiddenVisibilityPreferenceStore;
  fsRevision: number;
  busyId: string | null;
  preferencesReady: boolean;
  presentItem: (node: FsNode) => StartItemPresentation;
  onActivate: (node: FsNode) => void | Promise<void>;
  onSearchEverywhere: (query: string) => void;
  onPin: (kind: "native" | "element", id: string) => void;
  onSettings: () => void;
}

interface FolderListingSnapshot {
  folderId: FsNode["id"] | null;
  items: FsNode[];
}

function rootTrail(node: FsNode): StartTrailItem[] {
  return [{ id: node.id, name: node.name || "Start Menu" }];
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * Render adapter for the filesystem-backed Start surface.
 *
 * Durable reconciliation belongs to StartMenuReconciliationController. This
 * adapter owns only transient navigation/query/listing state over FsService.
 */
export function StartSurfaceController({
  active,
  fs,
  reconciliation,
  hiddenVisibility,
  fsRevision,
  busyId,
  preferencesReady,
  presentItem,
  onActivate,
  onSearchEverywhere,
  onPin,
  onSettings,
}: StartSurfaceControllerProps) {
  const initial = reconciliation.getSnapshot();
  const [controllerRevision, setControllerRevision] = useState(initial.revision);
  const [hiddenVisibilityRevision, setHiddenVisibilityRevision] = useState(0);
  const [trail, setTrail] = useState<StartTrailItem[]>(() => initial.root ? rootTrail(initial.root) : []);
  const [listing, setListing] = useState<FolderListingSnapshot>({ folderId: null, items: [] });
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [listingError, setListingError] = useState<string | null>(null);

  useEffect(() => {
    setControllerRevision(reconciliation.getSnapshot().revision);
    return reconciliation.subscribe(() => setControllerRevision(reconciliation.getSnapshot().revision));
  }, [reconciliation]);

  const reconciliationSnapshot = useMemo(
    () => reconciliation.getSnapshot(),
    [controllerRevision, reconciliation],
  );

  useEffect(() => hiddenVisibility.subscribe(() => {
    setHiddenVisibilityRevision((revision) => revision + 1);
  }), [hiddenVisibility]);

  useEffect(() => {
    const root = reconciliationSnapshot.root;
    if (!root) return;
    setTrail((current) => {
      if (current[0]?.id === root.id) return current;
      return rootTrail(root);
    });
  }, [reconciliationSnapshot.root?.id, reconciliationSnapshot.root?.name]);

  const currentFolder = trail.at(-1) ?? null;

  useEffect(() => {
    if (!active || !currentFolder) return undefined;
    let mounted = true;
    setBusy(true);
    void listVisibleStartMenuFolder(fs, currentFolder.id)
      .then((nodes) => {
        if (!mounted) return;
        setListing({ folderId: currentFolder.id, items: nodes });
        setListingError(null);
      })
      .catch((cause: unknown) => {
        if (mounted) setListingError(errorMessage(cause));
      })
      .finally(() => {
        if (mounted) setBusy(false);
      });
    return () => { mounted = false; };
  }, [active, currentFolder?.id, fs, fsRevision, controllerRevision, hiddenVisibilityRevision]);

  const hasCurrentSnapshot = currentFolder !== null && listing.folderId === currentFolder.id;
  const effectiveError = listingError ?? reconciliationSnapshot.error;
  const view = useMemo(() => projectStartSurfaceView({
    trail,
    items: listing.items,
    snapshotFolderId: listing.folderId,
    query,
    busy: busy || (!hasCurrentSnapshot && !effectiveError),
    error: effectiveError,
  }), [busy, effectiveError, hasCurrentSnapshot, listing, query, trail]);

  if (!active) return null;

  return <StartSurface
    view={view}
    busyId={busyId}
    preferencesReady={preferencesReady}
    presentItem={presentItem}
    onQueryChange={setQuery}
    onSearchEverywhere={onSearchEverywhere}
    onBack={() => {
      setTrail((current) => current.length > 1 ? current.slice(0, -1) : current);
      setQuery("");
    }}
    onOpen={(node) => {
      if (node.kind === "directory") {
        setTrail((current) => [...current, { id: node.id, name: node.name }]);
        setQuery("");
        return;
      }
      return onActivate(node);
    }}
    onPin={onPin}
    onSettings={onSettings}
  />;
}
