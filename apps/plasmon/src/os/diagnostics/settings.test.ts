import { describe, expect, test } from "bun:test";
import type { FsService } from "../contracts/index.ts";
import { MemoryFsRepository, PersistentFsService } from "../fs/index.ts";
import { PlasmonDiagnosticService, SYSTEM_LOG_PATH, type DiagnosticConsole } from "./service.ts";
import {
  DEFAULT_CONSOLE_MIN_LEVEL,
  DEFAULT_FILE_MIN_LEVEL,
  DIAGNOSTIC_SETTINGS_KEY,
  DiagnosticSettingsStore,
  normalizeDiagnosticSettings,
  resolveDiagnosticSettingsCapabilities,
} from "./settings.ts";

function createFs(): PersistentFsService {
  let nextId = 0;
  return new PersistentFsService(new MemoryFsRepository(), {
    now: () => 1_700_000_000_000,
    randomUUID: () => `00000000-0000-4000-8000-${(++nextId).toString().padStart(12, "0")}`,
  });
}

async function readSystemLog(fs: FsService): Promise<string> {
  const node = await fs.resolvePath(SYSTEM_LOG_PATH);
  if (!node) return "";
  return new TextDecoder().decode(await fs.read(node.id));
}

describe("DiagnosticSettingsStore", () => {
  test("uses documented safe defaults for missing settings", async () => {
    const store = new DiagnosticSettingsStore(createFs());

    expect(await store.load()).toEqual({
      version: 1,
      fileMinLevel: DEFAULT_FILE_MIN_LEVEL,
      consoleMinLevel: DEFAULT_CONSOLE_MIN_LEVEL,
    });
  });

  test("persists and restores file and console thresholds independently", async () => {
    const fs = createFs();
    const store = new DiagnosticSettingsStore(fs);
    await store.load();
    await store.setFileMinLevel("debug");
    await store.setConsoleMinLevel("critical");

    expect(await store.load()).toEqual({
      version: 1,
      fileMinLevel: "debug",
      consoleMinLevel: "critical",
    });
    const restored = await new DiagnosticSettingsStore(fs).load();
    expect(restored.fileMinLevel).toBe("debug");
    expect(restored.consoleMinLevel).toBe("critical");
  });

  test("falls back per field when persisted values are invalid", async () => {
    const fs = createFs();
    const root = await fs.resolvePath("/");
    if (!root) throw new Error("expected filesystem root");
    await fs.setMetadata(root.id, {
      [DIAGNOSTIC_SETTINGS_KEY]: {
        version: 1,
        fileMinLevel: "verbose",
        consoleMinLevel: "error",
        remoteReportingEnabled: "yes",
      },
    });

    const store = new DiagnosticSettingsStore(fs, { remoteReporting: true });
    expect(await store.load()).toEqual({
      version: 1,
      fileMinLevel: DEFAULT_FILE_MIN_LEVEL,
      consoleMinLevel: "error",
      remoteReportingEnabled: false,
    });
    expect(normalizeDiagnosticSettings(null, { remoteReporting: false })).toEqual({
      version: 1,
      fileMinLevel: DEFAULT_FILE_MIN_LEVEL,
      consoleMinLevel: DEFAULT_CONSOLE_MIN_LEVEL,
    });
  });

  test("remote policy is unavailable in Slim even when a remote capability is requested", async () => {
    const capabilities = resolveDiagnosticSettingsCapabilities({
      slimProfile: true,
      remoteIncidentSinkAvailable: true,
    });
    expect(capabilities).toEqual({ remoteReporting: false });

    const store = new DiagnosticSettingsStore(createFs(), capabilities);
    expect((await store.load()).remoteReportingEnabled).toBeUndefined();
    await expect(store.setRemoteReportingEnabled(true)).rejects.toThrow(
      "Remote diagnostic reporting is unavailable in this build",
    );
  });

  test("disabling supported remote reporting leaves local thresholds unchanged", async () => {
    const store = new DiagnosticSettingsStore(createFs(), { remoteReporting: true });
    await store.load();
    await store.setFileMinLevel("debug");
    await store.setConsoleMinLevel("error");
    await store.setRemoteReportingEnabled(true);
    await store.setRemoteReportingEnabled(false);

    expect(store.getSnapshot()).toEqual({
      version: 1,
      fileMinLevel: "debug",
      consoleMinLevel: "error",
      remoteReportingEnabled: false,
    });
  });

  test("applies independent sink threshold changes live without changing producer emission", async () => {
    const fs = createFs();
    const consoleLines: string[] = [];
    const diagnosticConsole: DiagnosticConsole = {
      debug: (...data) => consoleLines.push(`debug:${data.join(" ")}`),
      info: (...data) => consoleLines.push(`info:${data.join(" ")}`),
      warn: (...data) => consoleLines.push(`warn:${data.join(" ")}`),
      error: (...data) => consoleLines.push(`error:${data.join(" ")}`),
    };
    const diagnostics = new PlasmonDiagnosticService({ fs, console: diagnosticConsole });
    const store = new DiagnosticSettingsStore(fs);
    store.subscribe(({ fileMinLevel, consoleMinLevel }) => {
      diagnostics.setSinkMinimumLevels({ fileMinLevel, consoleMinLevel });
    });
    await store.load();
    await store.setFileMinLevel("error");
    await store.setConsoleMinLevel("debug");

    const observed: string[] = [];
    const unsubscribe = diagnostics.subscribe((record) => observed.push(record.event));
    diagnostics.emit({ level: "info", subsystem: "test", event: "info", message: "info" });
    diagnostics.emit({ level: "error", subsystem: "test", event: "error", message: "error" });
    await diagnostics.flush();
    unsubscribe();

    expect(observed).toEqual(["info", "error"]);
    expect(consoleLines.some((line) => line.includes("| INFO |"))).toBe(true);
    expect(consoleLines.some((line) => line.includes("| ERROR |"))).toBe(true);
    const log = await readSystemLog(fs);
    expect(log).not.toContain("| INFO |");
    expect(log).toContain("| ERROR |");
  });
});
