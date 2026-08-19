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
  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const refreshAgainRef = useRef(false);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!mountedRef.current) return;
    if (refreshPromiseRef.current) {
      // Fs events can arrive while an explicit post-mutation refresh is in
      // flight. Do not issue competing frontend filesystem calls: request one
      // serialized follow-up so the final projection observes the committed
      // filesystem state rather than whichever list response happened to win.
      refreshAgainRef.current = true;
      await refreshPromiseRef.current;
      return;
    }

    const operation = (async () => {
      do {
        refreshAgainRef.current = false;
        if (!mountedRef.current) return;
        const generation = refreshGateRef.current.begin();
        setLoading(true);
        try {
          const directory = await fs.stat(directoryId);
          if (directory.kind !== "directory") {
            throw new Error(`${directory.name} is not a directory`);
          }
          const listed = await fs.list(directoryId, { sort });
          if (!mountedRef.current || !refreshGateRef.current.isCurrent(generation)) continue;
          setNodes(listed);
          setSelection((current) =>
            reconcileSelection(current, new Set(listed.map((node) => node.id))),
          );
          setError(null);
        } catch (cause: unknown) {
          if (!mountedRef.current || !refreshGateRef.current.isCurrent(generation)) continue;
          setError(fileManagerErrorMessage(cause));
        } finally {
          if (mountedRef.current && refreshGateRef.current.isCurrent(generation)) setLoading(false);
        }
      } while (mountedRef.current && refreshAgainRef.current);
    })();

    refreshPromiseRef.current = operation;
    try {
      await operation;
    } finally {
      if (refreshPromiseRef.current === operation) refreshPromiseRef.current = null;
    }
  }, [directoryId, fs, setSelection, sort]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    return () => {
      mountedRef.current = false;
      refreshAgainRef.current = false;
      refreshGateRef.current.invalidate();
    };
  }, [refresh]);

  useEffect(() => {
    if (!fsEvents) return undefined;
    return fsEvents.subscribe((event) => {
      if (isFsEventRelevant(event, directoryId)) void refresh();
    });
  }, [directoryId, fsEvents, refresh]);

  return { nodes, loading, error, setError, refresh };
}
