import { expect, test } from "bun:test";
import {
  DEFAULT_MONACO_RUNTIME_CONFIG_TEXT,
  MONACO_RUNTIME_CONFIG_PATH,
  MONACO_RUNTIME_CONFIG_SCHEMA,
} from "../src/native-apps/monaco-runtime-config/runtimeConfig.ts";
import { createHeadlessPlasmonEnvironment } from "./headlessEnvironment.ts";

test("fresh production composition exposes editable Monaco config through OsApi and normal open routing", async () => {
  const env = createHeadlessPlasmonEnvironment();
  try {
    await env.ready;

    const resource = await env.os.fs.stat(MONACO_RUNTIME_CONFIG_PATH);
    expect(resource).toMatchObject({
      path: MONACO_RUNTIME_CONFIG_PATH,
      name: "config.json",
      kind: "file",
      mimeType: "application/json",
    });
    expect(await env.os.fs.readText(MONACO_RUNTIME_CONFIG_PATH)).toBe(DEFAULT_MONACO_RUNTIME_CONFIG_TEXT);

    let firstObserved: boolean | null = null;
    let secondObserved: boolean | null = null;
    const firstChanged = new Promise<void>((resolve) => {
      const unsubscribe = env.services.monacoRuntimeConfig.subscribe(() => {
        firstObserved = env.services.monacoRuntimeConfig.getSnapshot().editor.minimap.enabled;
        unsubscribe();
        resolve();
      });
    });
    const secondChanged = new Promise<void>((resolve) => {
      const unsubscribe = env.services.monacoRuntimeConfig.subscribe(() => {
        secondObserved = env.services.monacoRuntimeConfig.getSnapshot().editor.minimap.enabled;
        unsubscribe();
        resolve();
      });
    });
    const edited = `${JSON.stringify({
      schema: MONACO_RUNTIME_CONFIG_SCHEMA,
      editor: { minimap: { enabled: false } },
    }, null, 2)}\n`;
    await env.os.fs.writeText(MONACO_RUNTIME_CONFIG_PATH, edited);
    await Promise.all([firstChanged, secondChanged]);
    expect(await env.os.fs.readText(MONACO_RUNTIME_CONFIG_PATH)).toBe(edited);
    expect(env.services.monacoRuntimeConfig.getSnapshot().editor.minimap.enabled).toBe(false);
    expect(firstObserved).toBe(false);
    expect(secondObserved).toBe(false);

    const opened = await env.os.open(MONACO_RUNTIME_CONFIG_PATH);
    expect(opened.resource.path).toBe(MONACO_RUNTIME_CONFIG_PATH);
    expect(opened.handlerId).toBe("native:text");
    expect(opened.processId).toBeTruthy();
    expect(opened.windowId).toBeTruthy();
  } finally {
    env.dispose();
  }
});
