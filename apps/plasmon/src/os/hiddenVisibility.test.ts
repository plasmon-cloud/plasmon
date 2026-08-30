// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { FileManagerPreferenceStore } from "./file-manager/preferences.ts";
import {
  composeExplorerHiddenVisibility,
  readHiddenVisibilityPreferences,
} from "./hiddenVisibility.ts";
import { createHeadlessPlasmonEnvironment } from "../../test/headlessEnvironment.ts";

test("global hidden visibility defaults off, persists across service reconstruction, and preserves Explorer-local state", async () => {
  const first = createHeadlessPlasmonEnvironment();
  await first.ready;
  const local = new FileManagerPreferenceStore(first.services.fs);
  try {
    expect((await first.services.hiddenVisibility.load()).alwaysShowHiddenFiles).toBe(false);
    expect((await readHiddenVisibilityPreferences(first.services.fs)).alwaysShowHiddenFiles).toBe(false);

    await local.save({ version: 1, showHiddenFiles: true });
    await first.services.hiddenVisibility.setAlwaysShowHiddenFiles(true);
    expect(composeExplorerHiddenVisibility(true, false)).toEqual({
      effectiveShowHiddenFiles: true,
      checkboxChecked: true,
      checkboxDisabled: true,
    });
    expect(composeExplorerHiddenVisibility(true, true)).toEqual({
      effectiveShowHiddenFiles: true,
      checkboxChecked: true,
      checkboxDisabled: true,
    });

    await first.services.hiddenVisibility.setAlwaysShowHiddenFiles(false);
    expect((await local.load()).showHiddenFiles).toBe(true);
    expect(composeExplorerHiddenVisibility(false, true)).toEqual({
      effectiveShowHiddenFiles: true,
      checkboxChecked: true,
      checkboxDisabled: false,
    });
    expect(composeExplorerHiddenVisibility(false, false)).toEqual({
      effectiveShowHiddenFiles: false,
      checkboxChecked: false,
      checkboxDisabled: false,
    });

    await first.services.hiddenVisibility.setAlwaysShowHiddenFiles(true);
  } finally {
    first.dispose();
  }

  const reopened = createHeadlessPlasmonEnvironment({ repository: first.repository });
  await reopened.ready;
  try {
    expect((await reopened.services.hiddenVisibility.load()).alwaysShowHiddenFiles).toBe(true);
    expect((await new FileManagerPreferenceStore(reopened.services.fs).load()).showHiddenFiles).toBe(true);
  } finally {
    reopened.dispose();
  }
});

test("global hidden visibility does not weaken protected resource mutation policy", async () => {
  const env = createHeadlessPlasmonEnvironment();
  await env.ready;
  try {
    const properties = await env.node("/System/.Properties.sys");
    if (!properties) throw new Error("Properties system resource is unavailable");
    await env.services.hiddenVisibility.setAlwaysShowHiddenFiles(true);
    await expect(env.services.fs.rename(properties.id, "Properties.sys")).rejects.toThrow(/protected/i);
  } finally {
    env.dispose();
  }
});
