import { expect, test } from "bun:test";
import { act, render } from "@testing-library/react";
import {
  MonacoRuntimeConfigProvider,
  useMonacoRuntimeConfig,
} from "../../src/native-apps/monaco-runtime-config/runtimeConfigContext.tsx";
import {
  MONACO_RUNTIME_CONFIG_SCHEMA,
  type MonacoRuntimeConfigSnapshot,
  type MonacoRuntimeConfigStore,
} from "../../src/native-apps/monaco-runtime-config/runtimeConfig.ts";

function snapshot(enabled: boolean): MonacoRuntimeConfigSnapshot {
  return Object.freeze({
    schema: MONACO_RUNTIME_CONFIG_SCHEMA,
    editor: Object.freeze({
      minimap: Object.freeze({ enabled }),
    }),
  });
}

class MemoryRuntimeConfigStore implements MonacoRuntimeConfigStore {
  readonly ready = Promise.resolve();
  private current = snapshot(true);
  private readonly listeners = new Set<() => void>();

  readonly getSnapshot = (): MonacoRuntimeConfigSnapshot => this.current;

  get subscriberCount(): number {
    return this.listeners.size;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async setMinimapEnabled(enabled: boolean): Promise<void> {
    this.current = snapshot(enabled);
    for (const listener of [...this.listeners]) listener();
  }

  async restoreDefaults(): Promise<void> {
    await this.setMinimapEnabled(true);
  }

  dispose(): void {
    this.listeners.clear();
  }
}

function Consumer({ id }: { id: string }) {
  const { snapshot: current } = useMonacoRuntimeConfig();
  return <output data-testid={id}>{String(current.editor.minimap.enabled)}</output>;
}

test("one Monaco runtime config provider fans out live snapshots and releases mounted consumers", async () => {
  const store = new MemoryRuntimeConfigStore();
  const view = render(
    <MonacoRuntimeConfigProvider service={store}>
      <Consumer id="text-consumer" />
      <Consumer id="markdown-consumer" />
    </MonacoRuntimeConfigProvider>,
  );

  try {
    expect(store.subscriberCount).toBe(2);
    expect(view.getByTestId("text-consumer").textContent).toBe("true");
    expect(view.getByTestId("markdown-consumer").textContent).toBe("true");

    await act(async () => store.setMinimapEnabled(false));
    expect(view.getByTestId("text-consumer").textContent).toBe("false");
    expect(view.getByTestId("markdown-consumer").textContent).toBe("false");

    await act(async () => store.setMinimapEnabled(true));
    expect(view.getByTestId("text-consumer").textContent).toBe("true");
    expect(view.getByTestId("markdown-consumer").textContent).toBe("true");
  } finally {
    view.unmount();
  }

  expect(store.subscriberCount).toBe(0);
  store.dispose();
});
