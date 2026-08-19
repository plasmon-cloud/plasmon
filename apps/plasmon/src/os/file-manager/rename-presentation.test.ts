import { expect, test } from "bun:test";
import {
  inlineRenamePresentation,
  inlineRenameStyleVariables,
} from "./rename-presentation.ts";

test("#361 Desktop rename starts compact and grows vertically within a bounded editor", () => {
  const presentation = inlineRenamePresentation("desktop");
  expect(presentation).toEqual({
    rows: 1,
    wrap: "soft",
    autoGrow: true,
    maxHeight: "calc(10em + 8px)",
    desktopIdealWidthPx: 112,
    gridInlineInsetPx: null,
  });
  expect(inlineRenameStyleVariables(presentation)).toEqual({
    "--fm-rename-max-height": "calc(10em + 8px)",
    "--fm-desktop-rename-ideal-width": "112px",
  });
});

test("#361 Grid rename uses the same wrapped vertical policy without widening its tile", () => {
  const presentation = inlineRenamePresentation("grid");
  expect(presentation.wrap).toBe("soft");
  expect(presentation.autoGrow).toBe(true);
  expect(presentation.desktopIdealWidthPx).toBeNull();
  expect(presentation.gridInlineInsetPx).toBe(6);
  expect(inlineRenameStyleVariables(presentation)).toEqual({
    "--fm-rename-max-height": "calc(10em + 8px)",
    "--fm-grid-rename-inline-inset": "6px",
    "--fm-grid-rename-total-inset": "12px",
  });
});

test("#361 List and Details rename remain single-line editors", () => {
  for (const surface of ["list", "details"] as const) {
    const presentation = inlineRenamePresentation(surface);
    expect(presentation.rows).toBe(1);
    expect(presentation.wrap).toBe("off");
    expect(presentation.autoGrow).toBe(false);
    expect(presentation.maxHeight).toBe("calc(1.25em + 8px)");
    expect(inlineRenameStyleVariables(presentation)).toEqual({
      "--fm-rename-max-height": "calc(1.25em + 8px)",
    });
  }
});
