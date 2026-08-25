import type { ExternalElement, FsService, NativeAppDefinition } from "../contracts/index.ts";
import {
  isElementVisibleByDefault,
  isNativeAppVisibleByDefault,
  isShortcutTargetVisibleByDefault,
} from "./resourceVisibility.ts";
import {
  searchShell,
  type SearchBatch,
  type ShellSearchOptions,
} from "./search.ts";

/**
 * Product Search uses the ordinary filesystem hidden-resource policy. The core
 * search traversal already excludes hidden filesystem nodes; this adapter closes
 * the two projection leaks that traversal alone cannot see: direct application
 * definitions and visible shortcuts whose canonical targets are hidden.
 */
export async function searchShellVisibleByDefault(
  fs: FsService,
  nativeApps: readonly NativeAppDefinition[],
  elements: readonly ExternalElement[],
  query: string,
  options: ShellSearchOptions = {},
): Promise<SearchBatch> {
  const visibleNativeApps: NativeAppDefinition[] = [];
  for (const app of nativeApps) {
    if (app.runtimeOnly === true) continue;
    if (await isNativeAppVisibleByDefault(fs, app.handlerId)) visibleNativeApps.push(app);
  }

  const visibleElements: ExternalElement[] = [];
  for (const element of elements) {
    if (await isElementVisibleByDefault(fs, element.id)) visibleElements.push(element);
  }

  const batch = await searchShell(fs, visibleNativeApps, visibleElements, query, options);
  const visibility = await Promise.all(batch.results.map(async (result) => {
    if (result.kind !== "start-shortcut") return true;
    return isShortcutTargetVisibleByDefault(fs, result.target);
  }));

  return {
    ...batch,
    results: batch.results.filter((_result, index) => visibility[index]),
  };
}
