export interface MonacoEditorOptionValues {
  readOnly: boolean;
  ariaLabel: string;
  minimap: boolean;
  wordWrap: boolean;
}

export interface MonacoEditorOptionTarget {
  updateOptions(options: {
    readOnly: boolean;
    ariaLabel: string;
    minimap: { enabled: boolean };
    wordWrap: "on" | "off";
  }): void;
}

/** Applies presentation/runtime options to an existing Monaco editor in place. */
export function updateMonacoEditorOptions(
  editor: MonacoEditorOptionTarget,
  values: MonacoEditorOptionValues,
): void {
  editor.updateOptions({
    readOnly: values.readOnly,
    ariaLabel: values.ariaLabel,
    minimap: { enabled: values.minimap },
    wordWrap: values.wordWrap ? "on" : "off",
  });
}
