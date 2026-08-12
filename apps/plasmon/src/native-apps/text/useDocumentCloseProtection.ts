import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import type {
  NodeId,
  ProcessController,
  ProcessId,
} from "../../os/contracts/index.ts";
import type { DocumentSession } from "./document.ts";
import {
  DocumentCloseModel,
  type DocumentCloseSnapshot,
} from "./documentClose.ts";

const EMPTY_CLOSE_SNAPSHOT: DocumentCloseSnapshot = {
  pending: false,
  saving: false,
};

export interface DocumentCloseProtectionBinding {
  snapshot: DocumentCloseSnapshot;
  saveAndClose(): Promise<boolean>;
  discardAndClose(): boolean;
  cancelClose(): boolean;
}

/** React adapter only. Document close policy remains in DocumentCloseModel. */
export function useDocumentCloseProtection(
  process: ProcessController,
  processId: ProcessId,
  sessionRef: MutableRefObject<DocumentSession | null>,
  sessionKey: NodeId | undefined,
): DocumentCloseProtectionBinding {
  const [snapshot, setSnapshot] = useState<DocumentCloseSnapshot>(EMPTY_CLOSE_SNAPSHOT);
  const modelRef = useRef<DocumentCloseModel | null>(null);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;

    const model = new DocumentCloseModel(session);
    modelRef.current = model;
    const update = () => setSnapshot(model.snapshot());
    const unsubscribe = model.subscribe(update);
    update();

    const unregister = process.registerCloseHandler(
      processId,
      (request) => model.requestClose(request),
    );

    return () => {
      model.dispose();
      unregister();
      unsubscribe();
      if (modelRef.current === model) modelRef.current = null;
    };
  }, [process, processId, sessionKey, sessionRef]);

  return {
    snapshot,
    saveAndClose: () => modelRef.current?.saveAndClose() ?? Promise.resolve(false),
    discardAndClose: () => modelRef.current?.discardAndClose() ?? false,
    cancelClose: () => modelRef.current?.cancelClose() ?? false,
  };
}
