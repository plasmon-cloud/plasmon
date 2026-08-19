import { expect, test } from "bun:test";
import {
  inlineRenamePresentation,
  inlineRenameStyleVariables,
} from "./rename-presentation.ts";

test("#361 Desktop rename grows from content width to the bounded tile width", () => {
  const presentation = inlineRenamePresentation("desktop");
  expect(presentation).toEqual({
    rows: 1,
    wrap: "soft",
    autoGrow: true,
    maxHeight: "calc(10em + 8px)",
    minWidthPx: 36,
    desktopMaxWidthPx: 90,
    gridInlineInsetPx: null,
  });
  expect(inlineRenameStyleVariables(presentation)).toEqual({
    "--fm-rename-max-height": "calc(10em + 8px)",
    "--fm-rename-min-width": "36px",
    "--fm-desktop-rename-max-width": "90px",
  });
});

test("#361 Grid rename uses the same content-sized wrapped policy without widening its tile", () => {
  const presentation = inlineRenamePresentation("grid");
  expect(presentation.wrap).toBe("soft");
  expect(presentation.autoGrow).toBe(true);
  expect(presentation.minWidthPx).toBe(36);
  expect(presentation.desktopMaxWidthPx).toBeNull();
  expect(presentation.gridInlineInsetPx).toBe(6);
  expect(inlineRenameStyleVariables(presentation)).toEqual({
    "--fm-rename-max-height": "calc(10em + 8px)",
    "--fm-rename-min-width": "36px",
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
    expect(presentation.minWidthPx).toBeNull();
    expect(presentation.desktopMaxWidthPx).toBeNull();
    expect(inlineRenameStyleVariables(presentation)).toEqual({
      "--fm-rename-max-height": "calc(1.25em + 8px)",
    });
  }
});
