import { expect, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { NativeWindow } from "../../src/os/windowing/NativeWindow.tsx";
import { NativeWindowManager } from "../../src/os/windowing/NativeWindowManager.ts";

function setupWindow() {
  const manager = new NativeWindowManager({
    idFactory: () => "window:1",
    viewport: () => ({ x: 0, y: 0, width: 1280, height: 720 }),
    listenForViewportChanges: false,
  });
  manager.create("native:text#1", { width: 640, height: 480 });
  const state = manager.list()[0];
  if (!state) throw new Error("expected native window");
  return { manager, state };
}

test("lifecycle-owned close preserves the same rendered window while Process defers the request", () => {
  const { manager, state } = setupWindow();
  let closeRequests = 0;
  const view = render(
    <NativeWindow
      state={state}
      manager={manager}
      title="Text Editor"
      onRequestClose={() => {
        closeRequests += 1;
        return false;
      }}
    >
      <div>Unsaved document</div>
    </NativeWindow>,
  );

  try {
    const dialog = view.getByRole("dialog", { name: "Text Editor" });
    fireEvent.click(view.getByRole("button", { name: "Close" }));

    expect(closeRequests).toBe(1);
    expect(dialog.isConnected).toBe(true);
    expect(view.getByRole("dialog", { name: "Text Editor" })).toBe(dialog);
    expect(dialog.classList.contains("plasmon-window--closing")).toBe(false);
    expect(dialog.textContent).toContain("Unsaved document");
    expect(manager.list()).toEqual([
      expect.objectContaining({ id: state.id, processId: state.processId }),
    ]);
  } finally {
    view.unmount();
    manager.dispose();
  }
});

test("window-owned close without a lifecycle callback retains the close animation", () => {
  const { manager, state } = setupWindow();
  const view = render(
    <NativeWindow state={state} manager={manager} title="Utility">
      <div>Utility content</div>
    </NativeWindow>,
  );

  try {
    const dialog = view.getByRole("dialog", { name: "Utility" });
    fireEvent.click(view.getByRole("button", { name: "Close" }));

    expect(dialog.classList.contains("plasmon-window--closing")).toBe(true);
    expect(manager.list()).toHaveLength(1);

    fireEvent.animationEnd(dialog);
    expect(manager.list()).toEqual([]);
  } finally {
    view.unmount();
    manager.dispose();
  }
});
