import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type {
  FsEventSource,
  FsListOptions,
  FsNode,
  FsService,
  NodeId,
} from "../contracts/index.ts";
import {
  RefreshGate,
  isFsEventRelevant,
  reconcileSelection,
  type SelectionState,
} from "./model.ts";
import { fileManagerErrorMessage } from "./error-message.ts";
import { SerializedRefreshQueue } from "./serialized-refresh-queue.ts";

interface UseFileManagerDirectoryStateOptions {
  directoryId: NodeId;
  fs: FsService;
  fsEvents?: FsEventSource;
  sort: FsListOptions["sort"];
  setSelection: Dispatch<SetStateAction<SelectionState>>;
}

export function useFileManagerDirectoryState(
  options: UseFileManagerDirectoryStateOptions,
) {
  const { directoryId, fs, fsEvents, sort, setSelection } = options;
  const [nodes, setNodes] = useState<FsNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshGateRef = useRef(new RefreshGate());
  const refreshQueueRef = useRef(new SerializedRefreshQueue());
  const refreshScopeRef = useRef(0);

  const refreshDirectory = useCallback(async (clearErrorOnSuccess: boolean) => {
    const scope = refreshScopeRef.current;

    await refreshQueueRef.current.request(async () => {
      if (scope !== refreshScopeRef.current) return;
      const generation = refreshGateRef.current.begin();
      setLoading(true);
      try {
        const directory = await fs.stat(directoryId);
        if (directory.kind !== "directory") {
          throw new Error(`${directory.name} is not a directory`);
        }
        const listed = await fs.list(directoryId, { sort });
        if (
          scope !== refreshScopeRef.current
          || !refreshGateRef.current.isCurrent(generation)
        ) return;
        setNodes(listed);
        setSelection((selection) =>
          reconcileSelection(selection, new Set(listed.map((node) => node.id))),
        );
        if (clearErrorOnSuccess) setError(null);
      } catch (cause: unknown) {
        if (
          scope !== refreshScopeRef.current
          || !refreshGateRef.current.isCurrent(generation)
        ) return;
        setError(fileManagerErrorMessage(cause));
      } finally {
        if (
          scope === refreshScopeRef.current
          && refreshGateRef.current.isCurrent(generation)
        ) setLoading(false);
      }
    });
  }, [directoryId, fs, setSelection, sort]);

  const refresh = useCallback(
    () => refreshDirectory(true),
    [refreshDirectory],
  );

  useEffect(() => {
    const scope = refreshScopeRef.current;
    void refresh();
    return () => {
      if (refreshScopeRef.current === scope) refreshScopeRef.current += 1;
      refreshGateRef.current.invalidate();
    };
  }, [refresh]);

  useEffect(() => {
    if (!fsEvents) return undefined;
    return fsEvents.subscribe((event) => {
      if (isFsEventRelevant(event, directoryId)) void refreshDirectory(false);
    });
  }, [directoryId, fsEvents, refreshDirectory]);

  return { nodes, loading, error, setError, refresh };
}
