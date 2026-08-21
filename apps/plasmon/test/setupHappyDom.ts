import { Window } from "happy-dom";

const browserWindow = new Window({
  url: "http://localhost/",
  width: 1280,
  height: 720,
});

function installGlobal(name: string, value: unknown): void {
  if (value === undefined) return;
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });
}

installGlobal("window", browserWindow);
installGlobal("self", browserWindow);
installGlobal("document", browserWindow.document);
installGlobal("navigator", browserWindow.navigator);
installGlobal("location", browserWindow.location);
installGlobal("localStorage", browserWindow.localStorage);
installGlobal("sessionStorage", browserWindow.sessionStorage);

for (const name of [
  "Node",
  "Element",
  "HTMLElement",
  "HTMLButtonElement",
  "HTMLInputElement",
  "HTMLFormElement",
  "HTMLImageElement",
  "HTMLTextAreaElement",
  "SVGElement",
  "Event",
  "EventTarget",
  "UIEvent",
  "MouseEvent",
  "PointerEvent",
  "KeyboardEvent",
  "FocusEvent",
  "InputEvent",
  "CustomEvent",
  "MutationObserver",
  "DOMParser",
  "Range",
  "Selection",
  "File",
  "FileList",
  "DataTransfer",
  "ClipboardEvent",
] as const) {
  installGlobal(name, browserWindow[name]);
}

installGlobal("getComputedStyle", browserWindow.getComputedStyle.bind(browserWindow));
installGlobal("requestAnimationFrame", browserWindow.requestAnimationFrame.bind(browserWindow));
installGlobal("cancelAnimationFrame", browserWindow.cancelAnimationFrame.bind(browserWindow));
installGlobal("IS_REACT_ACT_ENVIRONMENT", true);
