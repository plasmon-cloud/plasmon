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

  const refresh = useCallback(async () => {
    const generation = refreshGateRef.current.begin();
    setLoading(true);
    try {
      const directory = await fs.stat(directoryId);
      if (directory.kind !== "directory") {
        throw new Error(`${directory.name} is not a directory`);
      }
      const listed = await fs.list(directoryId, { sort });
      if (!refreshGateRef.current.isCurrent(generation)) return;
      setNodes(listed);
      setSelection((current) =>
        reconcileSelection(current, new Set(listed.map((node) => node.id))),
      );
      setError(null);
    } catch (cause: unknown) {
      if (!refreshGateRef.current.isCurrent(generation)) return;
      setError(fileManagerErrorMessage(cause));
    } finally {
      if (refreshGateRef.current.isCurrent(generation)) setLoading(false);
    }
  }, [directoryId, fs, setSelection, sort]);

  useEffect(() => {
    void refresh();
    return () => refreshGateRef.current.invalidate();
  }, [refresh]);

  useEffect(() => {
    if (!fsEvents) return undefined;
    return fsEvents.subscribe((event) => {
      if (isFsEventRelevant(event, directoryId)) void refresh();
    });
  }, [directoryId, fsEvents, refresh]);

  return { nodes, loading, error, setError, refresh };
}
