import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type {
  MonacoRuntimeConfigSnapshot,
  MonacoRuntimeConfigStore,
} from "./runtimeConfig.ts";

const MonacoRuntimeConfigContext = createContext<MonacoRuntimeConfigStore | null>(null);

export interface MonacoRuntimeConfigProviderProps {
  service: MonacoRuntimeConfigStore;
  children: ReactNode;
}

export function MonacoRuntimeConfigProvider({ service, children }: MonacoRuntimeConfigProviderProps) {
  return (
    <MonacoRuntimeConfigContext.Provider value={service}>
      {children}
    </MonacoRuntimeConfigContext.Provider>
  );
}

export interface MonacoRuntimeConfigBinding {
  snapshot: MonacoRuntimeConfigSnapshot;
  setMinimapEnabled(enabled: boolean): Promise<void>;
  restoreDefaults(): Promise<void>;
}

export function useMonacoRuntimeConfig(): MonacoRuntimeConfigBinding {
  const service = useContext(MonacoRuntimeConfigContext);
  if (!service) {
    throw new Error("Monaco runtime configuration is unavailable outside Plasmon OS composition");
  }
  const snapshot = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
  return {
    snapshot,
    setMinimapEnabled: (enabled) => service.setMinimapEnabled(enabled),
    restoreDefaults: () => service.restoreDefaults(),
  };
}
