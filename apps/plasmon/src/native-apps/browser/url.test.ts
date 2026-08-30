import { expect, test } from "bun:test";
import type { FsService } from "../../os/contracts/index.ts";
import { normalizeHttpUrl, openExternalUrl, resolveBrowserTarget } from "./url.ts";

const shortcutFs = (content: string): FsService => ({
  stat: async (id: string) => ({ id, parentId: "root", name: "Example.url", kind: "shortcut", mime: "application/x-mswinurl", size: content.length, createdAt: 0, modifiedAt: 0, metadata: {} }),
  read: async () => new TextEncoder().encode(content),
} as unknown as FsService);

test("Browser resolves direct and .url targets through the existing shortcut format", async () => {
  const direct = await resolveBrowserTarget({ url: "https://example.com/path" }, shortcutFs(""));
  expect(direct.url).toBe("https://example.com/path");

  const fromShortcut = await resolveBrowserTarget(
    { nodeId: "shortcut" },
    shortcutFs("[InternetShortcut]\r\nURL=https://example.org/demo\r\nBaseURL=Browser\r\n"),
  );
  expect(fromShortcut).toEqual({ url: "https://example.org/demo", title: "Example.url" });
});

test("Browser accepts only HTTP(S) schemes", () => {
  expect(normalizeHttpUrl("https://example.com")).toBe("https://example.com/");
  expect(normalizeHttpUrl("http://example.com")).toBe("http://example.com/");
  expect(normalizeHttpUrl("javascript:alert(1)")).toBeNull();
  expect(normalizeHttpUrl("data:text/html,boom")).toBeNull();
  expect(normalizeHttpUrl("file:///etc/passwd")).toBeNull();
});

test("external open requests _blank with noopener,noreferrer", () => {
  const calls: string[][] = [];
  const opened = openExternalUrl("https://example.com", (...args) => calls.push(args));
  expect(opened).toBe(true);
  expect(calls).toEqual([["https://example.com/", "_blank", "noopener,noreferrer"]]);
  expect(openExternalUrl("javascript:alert(1)", (...args) => calls.push(args))).toBe(false);
  expect(calls).toHaveLength(1);
});
