import { classifyResource } from "../../../os/fs/index.ts";

export interface EditorValueModel {
  getValue(): string;
  setValue(value: string): void;
}

export function syncEditorModelValue(model: EditorValueModel, nextValue: string): boolean {
  if (model.getValue() === nextValue) return false;
  model.setValue(nextValue);
  return true;
}

export interface EditorLanguageModel {
  getLanguageId(): string;
}

/** Change the language of one existing live editor model only when needed. */
export function syncEditorModelLanguage<Model extends EditorLanguageModel>(
  model: Model,
  nextLanguage: string,
  setModelLanguage: (model: Model, language: string) => void,
): boolean {
  if (model.getLanguageId() === nextLanguage) return false;
  setModelLanguage(model, nextLanguage);
  return true;
}

/**
 * Monaco's model registry is global to the application realm. A semantic
 * document key therefore cannot also be the ownership identity for a live
 * editor surface: two surfaces with the same document key must never dispose
 * or mutate each other's models.
 */
export function editorModelUri(modelKey: string, instanceId: number): string {
  return `inmemory://plasmon/${encodeURIComponent(modelKey)}?surface=${instanceId}`;
}

export interface DisposableEditorModel {
  dispose(): void;
}

export interface OwnedEditorModel<Model extends DisposableEditorModel> {
  readonly uri: string;
  readonly model: Model;
  dispose(): void;
}

let nextEditorSurfaceInstanceId = 1;

/** Bind one concrete editor model to one live editor-host surface. */
export function createEditorSurfaceModelOwner<Model extends DisposableEditorModel>(
  modelKey: string,
  createModel: (uri: string) => Model,
): OwnedEditorModel<Model> {
  const uri = editorModelUri(modelKey, nextEditorSurfaceInstanceId++);
  const model = createModel(uri);
  let disposed = false;
  return {
    uri,
    model,
    dispose() {
      if (disposed) return;
      disposed = true;
      model.dispose();
    },
  };
}

/** Map canonical resource classification onto Monaco's language vocabulary. */
export function editorLanguageForResource(name: string, mime?: string): string {
  const classification = classifyResource({
    name,
    kind: "file",
    metadata: {},
    ...(mime ? { mime } : {}),
  });
  return classification.type.language ?? "plaintext";
}

export function editorLanguageForName(name: string): string {
  return editorLanguageForResource(name);
}
