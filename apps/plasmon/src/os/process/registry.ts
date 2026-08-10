import type {
  HandlerId,
  NativeAppDefinition,
  NativeAppRegistry,
} from "../contracts/index.ts";
import type { NativeAppComponent, NativeAppLoader } from "./runtime.ts";
import { normalizeNativeAppModule } from "./runtime.ts";

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

/**
 * Native app metadata registry plus the private React loader table used by the
 * process host. Public consumers only need the NativeAppRegistry methods.
 */
export class NativeApplicationRegistry implements NativeAppRegistry {
  private readonly definitions = new Map<string, NativeAppDefinition>();
  private readonly handlerToApp = new Map<HandlerId, string>();
  private readonly loaders = new Map<string, NativeAppLoader>();
  private readonly componentLoads = new Map<string, Promise<NativeAppComponent>>();

  register(definition: NativeAppDefinition): void {
    if (this.definitions.has(definition.id)) {
      throw new Error(`Native application already registered: ${definition.id}`);
    }
    const existingHandler = this.handlerToApp.get(definition.handlerId);
    if (existingHandler) {
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
      throw new Error(`Cannot attach a loader to unknown native application: ${appId}`);
    }
    this.loaders.set(appId, loader);
    this.componentLoads.delete(appId);
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

  loadComponent(appId: string): Promise<NativeAppComponent> {
    const cached = this.componentLoads.get(appId);
    if (cached) return cached;

    const loader = this.loaders.get(appId);
    if (!loader) {
      return Promise.reject(
        new Error(`No React host loader registered for native application: ${appId}`),
      );
    }

    const loading = loader()
      .then(normalizeNativeAppModule)
      .catch((error: unknown) => {
        this.componentLoads.delete(appId);
        throw error;
      });
    this.componentLoads.set(appId, loading);
    return loading;
  }
}
