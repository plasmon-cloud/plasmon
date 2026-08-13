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

    // The current Shell has no Alt-Tab adapter; this is the user-visible
    // contract expected after the Windowing MRU seam is consumed.
    expect(focusedProcessId(app)).toBe(first);
  } finally {
    app.dispose();
  }
});
