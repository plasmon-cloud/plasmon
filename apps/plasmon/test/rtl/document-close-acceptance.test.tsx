import { expect, spyOn, test } from "bun:test";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { useRef } from "react";
import type {
  NodeId,
  ProcessId,
  WindowState,
} from "../../src/os/contracts/index.ts";
import { DocumentClosePrompt } from "../../src/native-apps/text/DocumentClosePrompt.tsx";
import { DocumentSession } from "../../src/native-apps/text/document.ts";
import { useDocumentCloseProtection } from "../../src/native-apps/text/useDocumentCloseProtection.ts";
import { NativeWindow } from "../../src/os/windowing/NativeWindow.tsx";
import {
  createHeadlessPlasmonEnvironment,
  type HeadlessPlasmonEnvironment,
} from "../headlessEnvironment.ts";

interface DocumentScenario {
  label: string;
  path: string;
  fileName: string;
  handlerId: string;
  title: string;
  unsavedText: string;
}

const scenarios: readonly DocumentScenario[] = [
  {
    label: "Text",
    path: "/Desktop/Dirty Close.txt",
    fileName: "Dirty Close.txt",
    handlerId: "native:text",
    title: "Text Editor",
    unsavedText: "unsaved Text contents",
  },
  {
    label: "Markdown",
    path: "/Desktop/Dirty Close.md",
    fileName: "Dirty Close.md",
    handlerId: "native:markdown",
    title: "Markdown",
    unsavedText: "# unsaved Markdown contents",
  },
];

interface CloseHarnessProps {
  environment: HeadlessPlasmonEnvironment;
  processId: ProcessId;
  nodeId: NodeId;
  state: WindowState;
  title: string;
  session: DocumentSession;
}

function CloseHarness({
  environment,
  processId,
  nodeId,
  state,
  title,
  session,
}: CloseHarnessProps) {
  const sessionRef = useRef<DocumentSession | null>(session);
  const closeProtection = useDocumentCloseProtection(
    environment.services.process,
    processId,
    sessionRef,
    nodeId,
  );
  const snapshot = session.snapshot();

  return (
    <NativeWindow
      state={state}
      manager={environment.services.windows}
      title={title}
      onRequestClose={(_windowId, ownerProcessId) =>
        environment.services.process.close(ownerProcessId)}
    >
      <div>{snapshot.text}</div>
      {closeProtection.snapshot.pending && (
        <DocumentClosePrompt
          documentName={snapshot.name}
          saving={closeProtection.snapshot.saving}
          status={snapshot.status}
          error={snapshot.error}
          onSave={() => { void closeProtection.saveAndClose(); }}
          onDiscard={() => { closeProtection.discardAndClose(); }}
          onCancel={() => { closeProtection.cancelClose(); }}
        />
      )}
    </NativeWindow>
  );
}

async function setupScenario(scenario: DocumentScenario, dirty = true) {
  const environment = createHeadlessPlasmonEnvironment();
  await environment.ready;
  const resource = await environment.os.fs.writeText(scenario.path, "saved baseline");
  const opened = await environment.os.open(scenario.path);

  expect(opened.handlerId).toBe(scenario.handlerId);
  if (!opened.processId || !opened.windowId) {
    environment.dispose();
    throw new Error(`expected ${scenario.label} to open as a native process/window`);
  }

  const processId = opened.processId as ProcessId;
  const nodeId = resource.id as NodeId;
  const process = environment.os.processes.list().find((candidate) => candidate.id === opened.processId);
  const window = environment.os.windows.list().find((candidate) => candidate.id === opened.windowId);
  const state = environment.services.windows.list().find((candidate) => candidate.id === opened.windowId);
  if (!process || !window || !state) {
    environment.dispose();
    throw new Error(`expected ${scenario.label} process/window state`);
  }
  expect(process.title).toBe(scenario.title);

  const session = new DocumentSession(environment.services.fs);
  await session.setTarget(nodeId);
  if (dirty) session.edit(scenario.unsavedText);

  return {
    environment,
    nodeId,
    processId,
    process,
    window,
    state,
    session,
  };
}

for (const scenario of scenarios) {
  test(`dirty ${scenario.label} keeps the same window visible while confirmation is pending and Cancel preserves it`, async () => {
    const setup = await setupScenario(scenario);
    const view = render(
      <CloseHarness
        environment={setup.environment}
        processId={setup.processId}
        nodeId={setup.nodeId}
        state={setup.state}
        title={scenario.title}
        session={setup.session}
      />,
    );

    try {
      const dialog = view.getByRole("dialog", { name: scenario.title });
      fireEvent.click(view.getByRole("button", { name: "Close" }));

      expect(await view.findByRole("alertdialog", {
        name: `Save changes to ${scenario.fileName}?`,
      })).toBeDefined();
      expect(dialog.isConnected).toBe(true);
      expect(view.getByRole("dialog", { name: scenario.title })).toBe(dialog);
      expect(dialog.classList.contains("plasmon-window--closing")).toBe(false);
      expect(dialog.textContent).toContain(scenario.unsavedText);
      expect(setup.environment.os.processes.list().find(({ id }) => id === setup.processId)).toEqual(
        setup.process,
      );
      expect(setup.environment.os.windows.list().find(({ id }) => id === setup.window.id)).toEqual(
        setup.window,
      );

      fireEvent.click(view.getByRole("button", { name: "Cancel" }));
      await waitFor(() => {
        expect(view.queryByRole("alertdialog")).toBeNull();
      });

      expect(view.getByRole("dialog", { name: scenario.title })).toBe(dialog);
      expect(setup.session.snapshot()).toEqual(expect.objectContaining({
        dirty: true,
        text: scenario.unsavedText,
      }));
      expect(setup.environment.os.processes.list().find(({ id }) => id === setup.processId)).toEqual(
        setup.process,
      );
      expect(setup.environment.os.windows.list().find(({ id }) => id === setup.window.id)).toEqual(
        setup.window,
      );
    } finally {
      view.unmount();
      setup.session.dispose();
      setup.environment.dispose();
    }
  });
}

test("Save uses canonical document persistence and closes the process/window exactly once", async () => {
  const scenario = scenarios[0]!;
  const setup = await setupScenario(scenario);
  const closeSpy = spyOn(setup.environment.services.windows, "close");
  const view = render(
    <CloseHarness
      environment={setup.environment}
      processId={setup.processId}
      nodeId={setup.nodeId}
      state={setup.state}
      title={scenario.title}
      session={setup.session}
    />,
  );

  try {
    fireEvent.click(view.getByRole("button", { name: "Close" }));
    await view.findByRole("alertdialog", { name: `Save changes to ${scenario.fileName}?` });
    fireEvent.click(view.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(setup.environment.os.processes.list().some(({ id }) => id === setup.processId)).toBe(false);
      expect(setup.environment.os.windows.list().some(({ id }) => id === setup.window.id)).toBe(false);
    });
    expect(await setup.environment.os.fs.readText(scenario.path)).toBe(scenario.unsavedText);
    expect(setup.session.snapshot().dirty).toBe(false);
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(closeSpy).toHaveBeenCalledWith(setup.window.id);
  } finally {
    closeSpy.mockRestore();
    view.unmount();
    setup.session.dispose();
    setup.environment.dispose();
  }
});

test("Discard closes the process/window exactly once without persisting dirty contents", async () => {
  const scenario = scenarios[0]!;
  const setup = await setupScenario(scenario);
  const closeSpy = spyOn(setup.environment.services.windows, "close");
  const view = render(
    <CloseHarness
      environment={setup.environment}
      processId={setup.processId}
      nodeId={setup.nodeId}
      state={setup.state}
      title={scenario.title}
      session={setup.session}
    />,
  );

  try {
    fireEvent.click(view.getByRole("button", { name: "Close" }));
    await view.findByRole("alertdialog", { name: `Save changes to ${scenario.fileName}?` });
    fireEvent.click(view.getByRole("button", { name: "Discard" }));

    await waitFor(() => {
      expect(setup.environment.os.processes.list().some(({ id }) => id === setup.processId)).toBe(false);
      expect(setup.environment.os.windows.list().some(({ id }) => id === setup.window.id)).toBe(false);
    });
    expect(await setup.environment.os.fs.readText(scenario.path)).toBe("saved baseline");
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(closeSpy).toHaveBeenCalledWith(setup.window.id);
  } finally {
    closeSpy.mockRestore();
    view.unmount();
    setup.session.dispose();
    setup.environment.dispose();
  }
});

test("clean document close remains immediate and closes the process/window once", async () => {
  const scenario = scenarios[0]!;
  const setup = await setupScenario(scenario, false);
  const closeSpy = spyOn(setup.environment.services.windows, "close");
  const view = render(
    <CloseHarness
      environment={setup.environment}
      processId={setup.processId}
      nodeId={setup.nodeId}
      state={setup.state}
      title={scenario.title}
      session={setup.session}
    />,
  );

  try {
    fireEvent.click(view.getByRole("button", { name: "Close" }));

    expect(view.queryByRole("alertdialog")).toBeNull();
    expect(setup.environment.os.processes.list().some(({ id }) => id === setup.processId)).toBe(false);
    expect(setup.environment.os.windows.list().some(({ id }) => id === setup.window.id)).toBe(false);
    expect(await setup.environment.os.fs.readText(scenario.path)).toBe("saved baseline");
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(closeSpy).toHaveBeenCalledWith(setup.window.id);
  } finally {
    closeSpy.mockRestore();
    view.unmount();
    setup.session.dispose();
    setup.environment.dispose();
  }
});
