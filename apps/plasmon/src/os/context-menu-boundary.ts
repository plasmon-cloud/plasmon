export interface FirstPartyContextMenuHit {
  owned: boolean;
  editable: boolean;
  foreign: boolean;
}

export type FirstPartyContextMenuOwnership = "claim" | "pass";

/**
 * Decides only browser-event ownership. Specialized Shell/FileManager/app
 * adapters retain command and menu authority after a surface is claimed.
 */
export function resolveFirstPartyContextMenuOwnership(
  hit: FirstPartyContextMenuHit,
): FirstPartyContextMenuOwnership {
  return hit.owned && !hit.editable && !hit.foreign ? "claim" : "pass";
}

const EDITABLE_CONTEXT_SELECTOR = [
  "input",
  "textarea",
  "select",
  "[contenteditable]:not([contenteditable='false'])",
].join(",");

const FOREIGN_CONTEXT_SELECTOR = [
  "iframe",
  "[data-plasmon-context-menu-boundary='foreign']",
].join(",");

export function isEditableContextMenuTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(EDITABLE_CONTEXT_SELECTOR));
}

export function isForeignContextMenuTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(FOREIGN_CONTEXT_SELECTOR));
}

export function shouldClaimFirstPartyContextMenu(
  target: EventTarget | null,
  owned: boolean,
): boolean {
  return resolveFirstPartyContextMenuOwnership({
    owned,
    editable: isEditableContextMenuTarget(target),
    foreign: isForeignContextMenuTarget(target),
  }) === "claim";
}

/**
 * Claims the browser-native menu only when this adapter owns the target.
 * Returning false leaves propagation/default behavior untouched.
 */
export function claimFirstPartyContextMenu(
  event: Pick<Event, "target" | "defaultPrevented" | "preventDefault">,
  owned = true,
): boolean {
  if (event.defaultPrevented || !shouldClaimFirstPartyContextMenu(event.target, owned)) return false;
  event.preventDefault();
  return true;
}
