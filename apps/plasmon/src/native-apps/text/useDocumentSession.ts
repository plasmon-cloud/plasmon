import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { FsService, NodeId } from "../../os/contracts/index.ts";
import { DocumentSession, type DocumentSnapshot } from "./document.ts";
const EMPTY_SNAPSHOT: DocumentSnapshot = { nodeId: null, name: "", text: "", dirty: false, status: "idle", error: null };
export interface DocumentSessionBinding { snapshot: DocumentSnapshot; sessionRef: MutableRefObject<DocumentSession | null>; }
export function useDocumentSession(fs: FsService, nodeId: NodeId | undefined, options: { pollMs?: number; autosaveMs?: number } = {}): DocumentSessionBinding {
  const [snapshot, setSnapshot] = useState<DocumentSnapshot>(EMPTY_SNAPSHOT);
  const sessionRef = useRef<DocumentSession | null>(null);
  const pollMs = options.pollMs ?? 1500;
  const autosaveMs = options.autosaveMs ?? 900;
  useEffect(() => {
    const session = new DocumentSession(fs, { autosaveMs }); sessionRef.current = session;
    const unsubscribe = session.subscribe(() => setSnapshot(session.snapshot())); setSnapshot(session.snapshot()); void session.setTarget(nodeId ?? null);
    const interval = setInterval(() => { void session.checkExternalChange(); }, pollMs);
    return () => { clearInterval(interval); unsubscribe(); session.dispose({ flush: true }); if (sessionRef.current === session) sessionRef.current = null; };
  }, [autosaveMs, fs, nodeId, pollMs]);
  return { snapshot, sessionRef };
}
