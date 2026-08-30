import { expect, test } from "bun:test";
import type { DiagnosticRecord } from "../src/os/diagnostics/index.ts";
import { FsServiceAssociationDefaultStore } from "../src/os/associations/index.ts";
import type { FsService } from "../src/os/contracts/index.ts";
import { createHeadlessPlasmonEnvironment } from "./headlessEnvironment.ts";

function recordsFor(
  subscribe: (listener: (record: DiagnosticRecord) => void) => () => void,
): { records: DiagnosticRecord[]; stop: () => void } {
  const records: DiagnosticRecord[] = [];
  return { records, stop: subscribe((record) => records.push(record)) };
}

test("association default read failure emits one privacy-safe owning-boundary event", async () => {
  const env = createHeadlessPlasmonEnvironment();
  try {
    await env.ready;
    const { records, stop } = recordsFor((listener) => env.diagnostics.subscribe(listener));
    const failingFs = new Proxy(env.services.fs, {
      get(target, property, receiver) {
        if (property !== "resolvePath") return Reflect.get(target, property, receiver);
        return async () => {
          throw new TypeError("SECRET association read failure at /PRIVATE/read-path.txt");
        };
      },
    }) as FsService;
    const store = new FsServiceAssociationDefaultStore(failingFs, undefined, env.diagnostics);

    try {
      await expect(store.get("extension:.private")).rejects.toThrow("SECRET association read failure");
      const event = records.find((record) => record.event === "associations.defaults.read.failed");
      expect(event?.subsystem).toBe("associations");
      expect(event?.context).toEqual({ errorType: "TypeError" });
      expect(JSON.stringify(event)).not.toContain("SECRET association read failure");
      expect(JSON.stringify(event)).not.toContain("PRIVATE/read-path.txt");
    } finally {
      stop();
    }
  } finally {
    env.dispose();
  }
});

test("association default write failure emits one privacy-safe owning-boundary event", async () => {
  const env = createHeadlessPlasmonEnvironment();
  try {
    await env.ready;
    const { records, stop } = recordsFor((listener) => env.diagnostics.subscribe(listener));
    const failingFs = new Proxy(env.services.fs, {
      get(target, property, receiver) {
        if (property !== "setMetadata") return Reflect.get(target, property, receiver);
        return async () => {
          throw new TypeError("SECRET association failure at /PRIVATE/path.txt");
        };
      },
    }) as FsService;
    const store = new FsServiceAssociationDefaultStore(failingFs, undefined, env.diagnostics);

    try {
      await expect(store.set("extension:.private", "native:text")).rejects.toThrow("SECRET association failure");
      const event = records.find((record) => record.event === "associations.defaults.write.failed");
      expect(event?.subsystem).toBe("associations");
      expect(event?.context).toEqual({ errorType: "TypeError" });
      expect(JSON.stringify(event)).not.toContain("SECRET association failure");
      expect(JSON.stringify(event)).not.toContain("PRIVATE/path.txt");
    } finally {
      stop();
    }
  } finally {
    env.dispose();
  }
});

test("technical restore failure is logged without path identity", async () => {
  const env = createHeadlessPlasmonEnvironment();
  try {
    await env.ready;
    const fs = env.services.fs;
    const root = await fs.resolvePath("/");
    if (!root || root.kind !== "directory") throw new Error("root unavailable");
    const parent = await fs.mkdir(root.id, "PRIVATE-restore-parent");
    const file = await fs.createFile(parent.id, "PRIVATE-restore-file.txt", { mime: "text/plain" });
    await env.services.filesystem.trash.trash(file.id);
    await fs.remove(parent.id);

    const { records, stop } = recordsFor((listener) => env.diagnostics.subscribe(listener));
    try {
      await expect(
        env.services.filesystem.trash.restore(file.id, "/PRIVATE-missing-fallback"),
      ).rejects.toThrow("no restore fallback exists");
      const event = records.find((record) => record.event === "filesystem.trash.restore.failed");
      expect(event?.subsystem).toBe("filesystem");
      expect(event?.context).toEqual({ errorType: "Error" });
      expect(JSON.stringify(event)).not.toContain("PRIVATE-");
    } finally {
      stop();
    }
  } finally {
    env.dispose();
  }
});

test("expected protected-resource Trash denial remains quiet", async () => {
  const env = createHeadlessPlasmonEnvironment();
  try {
    await env.ready;
    const system = await env.services.fs.resolvePath("/System");
    if (!system) throw new Error("System directory unavailable");
    const { records, stop } = recordsFor((listener) => env.diagnostics.subscribe(listener));
    try {
      await expect(env.services.filesystem.trash.trash(system.id)).rejects.toThrow("protected");
      expect(records.some((record) => record.event === "filesystem.trash.failed")).toBe(false);
    } finally {
      stop();
    }
  } finally {
    env.dispose();
  }
});
