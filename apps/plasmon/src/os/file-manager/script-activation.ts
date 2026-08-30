import type { FsNode, OpenService } from "../contracts/index.ts";

export function isExecutableScriptNode(node: Pick<FsNode, "kind" | "name">): boolean {
  if (node.kind !== "file") return false;
  const lower = node.name.toLowerCase();
  return lower.endsWith(".cmd") || lower.endsWith(".run");
}

/**
 * .cmd/.run activation is execution, not generic document opening. Launch the
 * Terminal with the stable filesystem identity so the process receives the
 * exact script target even when association resolution and UI refresh overlap.
 */
export async function activateExecutableScript(
  openService: OpenService,
  node: Pick<FsNode, "id" | "kind" | "name">,
): Promise<boolean> {
  if (!isExecutableScriptNode(node)) return false;
  await openService.open("native:terminal", { nodeId: node.id });
  return true;
}
