import type { ExternalElement, FsService, NativeAppDefinition } from "../contracts/index.ts";
import { shouldShowHiddenResources } from "../hiddenVisibility.ts";
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
 * Product Search uses the ordinary filesystem hidden-resource policy while the
 * global visibility preference is disabled. When the global preference is
 * enabled, the core search path owns hidden-resource eligibility so direct app,
 * Element, and shortcut projections widen consistently with filesystem results.
 */
export async function searchShellVisibleByDefault(
  fs: FsService,
  nativeApps: readonly NativeAppDefinition[],
  elements: readonly ExternalElement[],
  query: string,
  options: ShellSearchOptions = {},
): Promise<SearchBatch> {
  if (await shouldShowHiddenResources(fs)) {
    return searchShell(fs, nativeApps, elements, query, options);
  }

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
