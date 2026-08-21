import type {
  ExternalElement,
  HandlerId,
  IconRef,
  NativeAppDefinition,
  NeutronBridge,
} from "../contracts/index.ts";

export {
  decideNativeTaskbarAction,
  deriveTaskbarEntries,
  deriveTaskbarPresentation,
  deriveTaskbarProjection,
  executeNativeTaskbarAction,
  focusNativeTaskbarMember,
  focusedWindow,
  windowForProcess,
} from "./taskbar.ts";
export type {
  ElementTaskbarEntry,
  NativeTaskbarAction,
  NativeTaskbarEntry,
  PresentedTaskbarEntry,
  TaskbarEntry,
  TaskbarModelInput,
  TaskbarPresentation,
  TaskbarPresentationState,
  TaskbarProjectionInput,
} from "./taskbar.ts";

export type ExternalRunning = ExternalElement["running"];

export interface ExternalOpenResult {
  refreshError: unknown | null;
}

/** Refresh failure is bounded: it is reported but never turns unknown into no or blocks opening. */
export async function openExternalElement(
  bridge: NeutronBridge,
  appId: string,
): Promise<ExternalOpenResult> {
  let refreshError: unknown | null = null;
  try {
    await bridge.refreshRuntimeState();
  } catch (error: unknown) {
    refreshError = error;
  }
  await bridge.openElement(appId);
  return { refreshError };
}

export interface StartNativeEntry {
  kind: "native";
  id: string;
  handlerId: HandlerId;
  appId: string;
  name: string;
  icon: IconRef;
}

export interface StartElementEntry {
  kind: "element";
  id: string;
  elementId: string;
  name: string;
  icon?: string;
  description: string;
  running: ExternalRunning;
}

export type StartAppEntry = StartNativeEntry | StartElementEntry;

export function deriveStartEntries(
  nativeApps: readonly NativeAppDefinition[],
  elements: readonly ExternalElement[],
): StartAppEntry[] {
  const entries: StartAppEntry[] = [
    ...nativeApps.map<StartNativeEntry>((app) => ({
      kind: "native",
      id: `native:${app.handlerId}`,
      handlerId: app.handlerId,
      appId: app.id,
      name: app.name,
      icon: app.icon,
    })),
    ...elements.map<StartElementEntry>((element) => ({
      kind: "element",
      id: `element:${element.id}`,
      elementId: element.id,
      name: element.name,
      ...(element.icon ? { icon: element.icon } : {}),
      description: element.description,
      running: element.running,
    })),
  ];
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

export function filterStartEntries(entries: readonly StartAppEntry[], query: string): StartAppEntry[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [...entries];
  return entries.filter((entry) => {
    const details = entry.kind === "element" ? entry.description : entry.appId;
    return `${entry.name}\n${details}`.toLocaleLowerCase().includes(needle);
  });
}

export interface TrayEntry {
  elementId: string;
  title: string;
  running: ExternalRunning;
}

/** Only the frozen vanilla tray declaration is surfaced. */
export function deriveTrayEntries(elements: readonly ExternalElement[]): TrayEntry[] {
  return elements.flatMap((element) => {
    const title = element.tray?.title;
    if (typeof title !== "string" || !title.trim()) return [];
    return [{ elementId: element.id, title, running: element.running }];
  });
}
