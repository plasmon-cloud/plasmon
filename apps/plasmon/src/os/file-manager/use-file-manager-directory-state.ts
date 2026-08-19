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

interface RefreshOperation {
  scope: number;
  promise: Promise<void>;
}

export function useFileManagerDirectoryState(
  options: UseFileManagerDirectoryStateOptions,
) {
  const { directoryId, fs, fsEvents, sort, setSelection } = options;
  const [nodes, setNodes] = useState<FsNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshGateRef = useRef(new RefreshGate());
  const refreshOperationRef = useRef<RefreshOperation | null>(null);
  const refreshAgainRef = useRef(false);
  const refreshScopeRef = useRef(0);

  const refresh = useCallback(async () => {
    const scope = refreshScopeRef.current;
    const current = refreshOperationRef.current;
    if (current?.scope === scope) {
      // Fs events can arrive while an explicit post-mutation refresh is in
      // flight. Do not issue competing frontend filesystem calls: request one
      // serialized follow-up so the final projection observes the committed
      // filesystem state rather than whichever list response happened to win.
      refreshAgainRef.current = true;
      await current.promise;
      return;
    }

    const operation = (async () => {
      do {
        refreshAgainRef.current = false;
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
          ) continue;
          setNodes(listed);
          setSelection((selection) =>
            reconcileSelection(selection, new Set(listed.map((node) => node.id))),
          );
          setError(null);
        } catch (cause: unknown) {
          if (
            scope !== refreshScopeRef.current
            || !refreshGateRef.current.isCurrent(generation)
          ) continue;
          setError(fileManagerErrorMessage(cause));
        } finally {
          if (
            scope === refreshScopeRef.current
            && refreshGateRef.current.isCurrent(generation)
          ) setLoading(false);
        }
      } while (scope === refreshScopeRef.current && refreshAgainRef.current);
    })();

    refreshOperationRef.current = { scope, promise: operation };
    try {
      await operation;
    } finally {
      if (refreshOperationRef.current?.promise === operation) {
        refreshOperationRef.current = null;
      }
    }
  }, [directoryId, fs, setSelection, sort]);

  useEffect(() => {
    const scope = refreshScopeRef.current;
    void refresh();
    return () => {
      if (refreshScopeRef.current === scope) refreshScopeRef.current += 1;
      refreshAgainRef.current = false;
      refreshGateRef.current.invalidate();
      if (refreshOperationRef.current?.scope === scope) refreshOperationRef.current = null;
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
