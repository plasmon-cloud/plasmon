import type { FsNode, NodeId } from "../contracts/index.ts";

export type DirectoryDropHit =
  | { kind: "entry"; nodeId: NodeId; nodeKind: FsNode["kind"] | undefined }
  | { kind: "surface"; directoryId: NodeId };

/**
 * Pick the first semantically visible directory candidate from the browser hit
 * stack. A resource entry blocks its containing FileManager surface: dropping on
 * a normal file is not silently reinterpreted as dropping on the folder behind
 * that file. Surface hits let another FileManager instance expose its current
 * directory by stable NodeId without sharing hidden drag state.
 */
export function directoryDropCandidateId(
  hits: readonly DirectoryDropHit[],
  draggedIds: readonly NodeId[],
): NodeId | null {
  const dragged = new Set(draggedIds);
  for (const hit of hits) {
    if (hit.kind === "entry") {
      if (dragged.has(hit.nodeId)) return null;
      return hit.nodeKind === "directory" ? hit.nodeId : null;
    }
    if (!dragged.has(hit.directoryId)) return hit.directoryId;
  }
  return null;
}

export function directoryDropTargetId(
  nodes: readonly FsNode[],
  draggedIds: readonly NodeId[],
  candidateId: NodeId | null | undefined,
): NodeId | null {
  if (!candidateId) return null;
  const target = nodes.find((node) => node.id === candidateId);
  if (!target) return null;
  return directoryDropCandidateId([
    { kind: "entry", nodeId: target.id, nodeKind: target.kind },
  ], draggedIds);
}
