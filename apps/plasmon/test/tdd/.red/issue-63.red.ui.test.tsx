import { expect, test } from "bun:test";
import { act, waitFor } from "@testing-library/react";
import { renderPlasmon } from "../../renderPlasmon.tsx";

function focusedProcessId(app: Awaited<ReturnType<typeof renderPlasmon>>): string | null {
  return app.environment.windows().sort((a, b) => b.z - a.z)[0]?.processId ?? null;
}

test("Alt-Tab cycles from the focused native window through Windowing MRU", async () => {
  const app = await renderPlasmon();
  try {
    let first: string | null = null;
    let second: string | null = null;
    await act(async () => {
      first = await app.environment.services.process.open("native:explorer", {});
      second = await app.environment.services.process.open("native:text", {});
    });
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    await waitFor(() => expect(app.environment.windows()).toHaveLength(2));
    expect(focusedProcessId(app)).toBe(second);
    await app.user.keyboard("{Alt>}{Tab}{/Alt}");
    expect(focusedProcessId(app)).toBe(first);
  } finally { app.dispose(); }
});

test("Alt-Tab exposes an accessible switcher while the modifier is held", async () => {
  const app = await renderPlasmon();
  try {
    await act(async () => {
      await app.environment.services.process.open("native:explorer", {});
      await app.environment.services.process.open("native:text", {});
    });
    await waitFor(() => expect(app.environment.windows()).toHaveLength(2));
    await app.user.keyboard("{Alt>}{Tab}");
    expect(app.getByRole("listbox", { name: "Window switcher" })).toBeDefined();
    await app.user.keyboard("{/Alt}");
  } finally { app.dispose(); }
});
