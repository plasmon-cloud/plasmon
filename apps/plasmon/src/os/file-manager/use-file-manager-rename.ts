import {
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { FsNode, FsService } from "../contracts/index.ts";
import { renameNode } from "./model.ts";
import type { InlineRenameState } from "./rename.ts";
import { fileManagerErrorMessage } from "./error-message.ts";

interface UseFileManagerRenameOptions {
  fs: FsService;
  refresh: () => Promise<void>;
  setError: Dispatch<SetStateAction<string | null>>;
  closeContextMenu: () => void;
}

export function useFileManagerRename(options: UseFileManagerRenameOptions) {
  const { fs, refresh, setError, closeContextMenu } = options;
  const [rename, setRename] = useState<InlineRenameState | null>(null);
  const sessionRef = useRef(0);
  const commitRef = useRef<string | null>(null);

  const begin = (node: FsNode) => {
    sessionRef.current += 1;
    commitRef.current = null;
    setRename({
      nodeId: node.id,
      value: node.name,
      initialName: node.name,
      session: sessionRef.current,
      error: null,
      busy: false,
    });
  };

  const start = (node: FsNode) => {
    closeContextMenu();
    begin(node);
  };

  const commit = async () => {
    if (!rename || rename.busy || commitRef.current === rename.nodeId) return;
    const state = rename;
    if (state.value === state.initialName) {
      setRename(null);
      setError(null);
      return;
    }

    commitRef.current = state.nodeId;
    setRename({ ...state, busy: true, error: null });
    try {
      await renameNode(fs, state.nodeId, state.value);
      setRename(null);
      setError(null);
      await refresh();
    } catch (cause: unknown) {
      commitRef.current = null;
      setRename({
        ...state,
        busy: false,
        error: fileManagerErrorMessage(cause),
      });
    }
  };

  const cancel = () => {
    commitRef.current = null;
    setRename(null);
  };

  const change = (value: string) => {
    setRename((current) => current ? { ...current, value, error: null } : null);
  };

  return { rename, begin, start, change, commit, cancel };
}
