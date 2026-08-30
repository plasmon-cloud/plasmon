import type {
  HandlerId,
  NativeAppDefinition,
  NativeAppRegistry,
} from "../contracts/index.ts";
import type { DiagnosticLogger } from "../diagnostics/index.ts";
import type { NativeAppComponent, NativeAppLoader } from "./runtime.ts";
import { normalizeNativeAppModule } from "./runtime.ts";

export interface NativeApplicationRegistryOptions {
  diagnostics?: DiagnosticLogger;
}

function cloneDefinition(definition: NativeAppDefinition): NativeAppDefinition {
  return {
    ...definition,
    defaultWindow: { ...definition.defaultWindow },
    associations: definition.associations.map((rule) => ({
      ...rule,
      ...(rule.extensions ? { extensions: [...rule.extensions] } : {}),
      ...(rule.mimeTypes ? { mimeTypes: [...rule.mimeTypes] } : {}),
      ...(rule.atomTypes ? { atomTypes: [...rule.atomTypes] } : {}),
    })),
  };
}

function diagnosticErrorType(error: unknown): string {
  return error instanceof Error ? error.name || "Error" : typeof error;
}

function isWeakKey(value: unknown): value is object {
  return (typeof value === "object" && value !== null) || typeof value === "function";
}

/**
 * Native app metadata registry plus the private React loader table used by the
 * process host. Public consumers only need the NativeAppRegistry methods.
 */
export class NativeApplicationRegistry implements NativeAppRegistry {
  private readonly definitions = new Map<string, NativeAppDefinition>();
  private readonly handlerToApp = new Map<HandlerId, string>();
  private readonly loaders = new Map<string, NativeAppLoader>();
  private readonly componentLoads = new Map<string, Promise<NativeAppComponent>>();
  private readonly objectLoadFailures = new WeakSet<object>();
  private readonly primitiveLoadFailures = new Map<string, unknown>();

  constructor(private readonly options: NativeApplicationRegistryOptions = {}) {}

  register(definition: NativeAppDefinition): void {
    if (this.definitions.has(definition.id)) {
      this.options.diagnostics?.error("native-app.registration.failed", {
        message: "Native application registration failed",
        appId: definition.id,
        handlerId: definition.handlerId,
        reason: "duplicate-app-id",
      });
      throw new Error(`Native application already registered: ${definition.id}`);
    }
    const existingHandler = this.handlerToApp.get(definition.handlerId);
    if (existingHandler) {
      this.options.diagnostics?.error("native-app.registration.failed", {
        message: "Native application registration failed",
        appId: definition.id,
        handlerId: definition.handlerId,
        reason: "duplicate-handler",
      });
      throw new Error(
        `Native handler ${definition.handlerId} is already registered by ${existingHandler}`,
      );
    }

    const stored = cloneDefinition(definition);
    this.definitions.set(stored.id, stored);
    this.handlerToApp.set(stored.handlerId, stored.id);
  }

  registerWithLoader(definition: NativeAppDefinition, loader: NativeAppLoader): void {
    this.register(definition);
    this.setLoader(definition.id, loader);
  }

  setLoader(appId: string, loader: NativeAppLoader): void {
    if (!this.definitions.has(appId)) {
      this.options.diagnostics?.error("native-app.registration.failed", {
        message: "Native application loader registration failed",
        appId,
        reason: "unknown-loader-app",
      });
      throw new Error(`Cannot attach a loader to unknown native application: ${appId}`);
    }
    this.loaders.set(appId, loader);
    this.componentLoads.delete(appId);
    this.primitiveLoadFailures.delete(appId);
  }

  get(id: string): NativeAppDefinition | null {
    const definition = this.definitions.get(id);
    return definition ? cloneDefinition(definition) : null;
  }

  getByHandler(handlerId: HandlerId): NativeAppDefinition | null {
    const id = this.handlerToApp.get(handlerId);
    return id ? this.get(id) : null;
  }

  list(): readonly NativeAppDefinition[] {
    return [...this.definitions.values()].map(cloneDefinition);
  }

  hasLoader(appId: string): boolean {
    return this.loaders.has(appId);
  }

  /** Lets the generic Process host avoid double-reporting a loader rejection as an application crash. */
  isLoadFailure(appId: string, error: unknown): boolean {
    if (isWeakKey(error)) return this.objectLoadFailures.has(error);
    return this.primitiveLoadFailures.get(appId) === error;
  }

  loadComponent(appId: string): Promise<NativeAppComponent> {
    const cached = this.componentLoads.get(appId);
    if (cached) return cached;

    const loader = this.loaders.get(appId);
    if (!loader) {
      const error = new Error(`No React host loader registered for native application: ${appId}`);
      this.rememberLoadFailure(appId, error);
      this.options.diagnostics?.error("native-app.load.failed", {
        message: "Native application host loader is unavailable",
        appId,
        reason: "missing-loader",
        errorType: diagnosticErrorType(error),
      });
      return Promise.reject(error);
    }

    const loading = loader()
      .then(normalizeNativeAppModule)
      .catch((error: unknown) => {
        this.componentLoads.delete(appId);
        this.rememberLoadFailure(appId, error);
        this.options.diagnostics?.error("native-app.load.failed", {
          message: "Native application host loader failed",
          appId,
          reason: "loader-rejected",
          errorType: diagnosticErrorType(error),
        });
        throw error;
      });
    this.componentLoads.set(appId, loading);
    return loading;
  }

  private rememberLoadFailure(appId: string, error: unknown): void {
    if (isWeakKey(error)) {
      this.objectLoadFailures.add(error);
      this.primitiveLoadFailures.delete(appId);
      return;
    }
    this.primitiveLoadFailures.set(appId, error);
  }
}
