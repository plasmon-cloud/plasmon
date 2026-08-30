import { describe, expect, test } from "bun:test";
import {
  installRuntimeDiagnosticCapture,
  type RuntimeDiagnosticEventTarget,
} from "../src/os/diagnostics/runtimeCapture.ts";
import { observeDiagnostics } from "./diagnosticObserver.ts";
import { createHeadlessPlasmonEnvironment } from "./headlessEnvironment.ts";

class FakeRuntimeTarget implements RuntimeDiagnosticEventTarget {
  readonly #listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const listeners = this.#listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>();
    listeners.add(listener);
    this.#listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.#listeners.get(type)?.delete(listener);
  }

  dispatch(type: string, event: unknown): void {
    for (const listener of this.#listeners.get(type) ?? []) {
      if (typeof listener === "function") listener(event as Event);
      else listener.handleEvent(event as Event);
    }
  }
}

function privateFailure(): TypeError {
  const failure = new TypeError(
    "PRIVATE_DOCUMENT_SENTINEL Bearer private-token https://private.example/doc?token=private-token",
  );
  failure.stack = [
    "TypeError: PRIVATE_DOCUMENT_SENTINEL",
    "    at randomFunction (https://private.example/Users/alice/private-document.ts?token=private-token:4:2)",
    "    at https://private.example/Users/alice/private-document.ts:9:1",
  ].join("\n");
  return failure;
}

function serialized(value: unknown): string {
  return JSON.stringify(value);
}

describe("global runtime diagnostic capture", () => {
  test("an uncaught browser exception emits exactly one sanitized canonical record without swallowing it", async () => {
    const env = createHeadlessPlasmonEnvironment();
    const observed = observeDiagnostics(env.diagnostics);
    const target = new FakeRuntimeTarget();
    const capture = installRuntimeDiagnosticCapture(env.diagnostics, target);
    let prevented = 0;
    try {
      await env.ready;
      const failure = privateFailure();
      target.dispatch("error", {
        error: failure,
        message: failure.message,
        filename: "https://private.example/Users/alice/private-document.ts?token=private-token",
        preventDefault: () => { prevented += 1; },
      });

      const records = await observed.settle({
        subsystem: "runtime",
        event: "runtime.uncaught-error",
        level: "error",
      });
      expect(records).toHaveLength(1);
      expect(records[0]?.context).toEqual({
        category: "uncaught-exception",
        source: "window.error",
      });
      expect(records[0]?.error).toEqual({
        name: "TypeError",
        message: "Unexpected uncaught runtime failure",
        stack: "TypeError\nat randomFunction",
      });
      expect(serialized(records[0])).not.toContain("PRIVATE_DOCUMENT_SENTINEL");
      expect(serialized(records[0])).not.toContain("private-token");
      expect(serialized(records[0])).not.toContain("private.example");
      expect(serialized(records[0])).not.toContain("/Users/alice");
      expect(prevented).toBe(0);
    } finally {
      capture.dispose();
      observed.dispose();
      env.dispose();
    }
  });

  test("an unhandled rejection emits exactly one canonical record without retaining its payload", async () => {
    const env = createHeadlessPlasmonEnvironment();
    const observed = observeDiagnostics(env.diagnostics);
    const target = new FakeRuntimeTarget();
    const capture = installRuntimeDiagnosticCapture(env.diagnostics, target);
    let prevented = 0;
    try {
      await env.ready;
      const failure = privateFailure();
      target.dispatch("unhandledrejection", {
        reason: failure,
        preventDefault: () => { prevented += 1; },
      });

      const records = await observed.settle({
        subsystem: "runtime",
        event: "runtime.unhandled-rejection",
        level: "error",
      });
      expect(records).toHaveLength(1);
      expect(records[0]?.context).toEqual({
        category: "unhandled-rejection",
        source: "unhandledrejection",
      });
      expect(records[0]?.error?.name).toBe("TypeError");
      expect(records[0]?.error?.stack).toBe("TypeError\nat randomFunction");
      expect(serialized(records[0])).not.toContain("PRIVATE_DOCUMENT_SENTINEL");
      expect(serialized(records[0])).not.toContain("private-token");
      expect(prevented).toBe(0);
    } finally {
      capture.dispose();
      observed.dispose();
      env.dispose();
    }
  });

  test("overlapping browser and React observation of one Error produces one incident", async () => {
    const env = createHeadlessPlasmonEnvironment();
    const observed = observeDiagnostics(env.diagnostics);
    const target = new FakeRuntimeTarget();
    const capture = installRuntimeDiagnosticCapture(env.diagnostics, target);
    try {
      await env.ready;
      const failure = privateFailure();
      target.dispatch("error", { error: failure });
      capture.onReactUncaughtError(failure);
      target.dispatch("unhandledrejection", { reason: failure });

      const records = await observed.settle({ subsystem: "runtime", level: "error" });
      expect(records).toHaveLength(1);
      expect(records[0]?.event).toBe("runtime.uncaught-error");
    } finally {
      capture.dispose();
      observed.dispose();
      env.dispose();
    }
  });

  test("ordinary uncaught Product code requires no diagnostics import at the throwing site", async () => {
    const env = createHeadlessPlasmonEnvironment();
    const observed = observeDiagnostics(env.diagnostics);
    const target = new FakeRuntimeTarget();
    const capture = installRuntimeDiagnosticCapture(env.diagnostics, target);
    try {
      await env.ready;
      function randomFunction(): never {
        throw new Error("boom");
      }

      let escaped: unknown;
      try {
        randomFunction();
      } catch (error) {
        escaped = error;
      }
      target.dispatch("error", { error: escaped });

      expect(await observed.settle({
        subsystem: "runtime",
        event: "runtime.uncaught-error",
      })).toHaveLength(1);
    } finally {
      capture.dispose();
      observed.dispose();
      env.dispose();
    }
  });
});
