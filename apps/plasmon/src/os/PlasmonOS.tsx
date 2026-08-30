import { useEffect, useMemo, useState } from "react";
import { MonacoRuntimeConfigProvider } from "../native-apps/monaco-runtime-config/runtimeConfigContext.tsx";
import { Desktop } from "./desktop/index.ts";
import { NativeProcessHost } from "./process/index.ts";
import { AltTabBoundary } from "./shell/AltTabBoundary.tsx";
import { Shell } from "./shell/index.ts";
import { NativeWindow, WindowLayer } from "./windowing/index.ts";
import { ResourceIcon, nativeHandlerResourcePresentation } from "./visual/index.ts";
import { createPlasmonServices, type PlasmonServices } from "./integration/services.ts";

export interface PlasmonOSProps {
  services?: PlasmonServices;
}

/**
 * Integration-owned OS composition root. Native applications render in
 * Plasmon-managed windows; real Neutron Elements are only opened through the
 * Shell/NeutronBridge and remain Kernel-owned sibling tiles.
 */
export function PlasmonOS({ services: provided }: PlasmonOSProps) {
  const services = useMemo(() => provided ?? createPlasmonServices(), [provided]);
  const [processRevision, setProcessRevision] = useState(0);

  useEffect(
    () => services.process.subscribe(() => setProcessRevision((value) => value + 1)),
    [services.process],
  );

  const processById = useMemo(
    () => new Map(services.process.list().map((record) => [record.id, record] as const)),
    [processRevision, services.process],
  );

  return (
    <MonacoRuntimeConfigProvider service={services.monacoRuntimeConfig}>
      <Shell
        process={services.process}
        windows={services.windows}
        fs={services.fs}
        fsEvents={services.fsEvents}
        neutron={services.neutron}
        nativeApps={services.nativeApps}
        filesystemOpen={services.filesystem.open}
        openService={services.openService}
        startMenu={services.startMenu}
        hiddenVisibility={services.hiddenVisibility}
      >
        <AltTabBoundary process={services.process} windows={services.windows}>
          <div className="plasmon-os-workspace">
            <div className="plasmon-os-desktop-layer">
              <Desktop
                fs={services.fs}
                openAuthority={services.filesystem.open}
                trashAuthority={services.filesystem.trash}
                fsEvents={services.fsEvents}
                process={services.process}
                associations={services.associations}
                openService={services.openService}
                clipboard={services.fileClipboard}
              />
            </div>

            <div className="plasmon-os-window-layer-wrap">
              <WindowLayer
                manager={services.windows}
                renderWindow={(state, active) => {
                  const record = processById.get(state.processId);
                  const title = record?.title ?? "Plasmon";
                  const nativeWindow = {
                    maximized: state.maximized,
                    maximize: () => services.windows.maximize(state.id),
                    restore: () => services.windows.restore(state.id),
                  };
                  return (
                    <NativeWindow
                      key={state.id}
                      state={state}
                      manager={services.windows}
                      title={title}
                      icon={record ? (
                        <ResourceIcon
                          context="titlebar"
                          frameVariant="bare"
                          presentation={nativeHandlerResourcePresentation(record.handlerId, record.icon)}
                        />
                      ) : null}
                      active={active}
                      onRequestClose={(_windowId, processId) => services.process.close(processId)}
                    >
                      {record ? (
                        <NativeProcessHost
                          processId={record.id}
                          registry={services.nativeApps}
                          process={services.process}
                          fs={services.fs}
                          nativeWindow={nativeWindow}
                          fallback={<div className="plasmon-os-host-state" role="status">Loading {title}…</div>}
                          missingFallback={<div className="plasmon-os-host-state" role="alert">Application host is unavailable.</div>}
                          errorFallback={(error) => (
                            <div className="plasmon-os-host-state plasmon-os-host-state--error" role="alert">
                              Application failed to render: {error instanceof Error ? error.message : String(error)}
                            </div>
                          )}
                        />
                      ) : (
                        <div className="plasmon-os-host-state" role="alert">Process record is unavailable.</div>
                      )}
                    </NativeWindow>
                  );
                }}
              />
            </div>
          </div>
        </AltTabBoundary>
      </Shell>
    </MonacoRuntimeConfigProvider>
  );
}
