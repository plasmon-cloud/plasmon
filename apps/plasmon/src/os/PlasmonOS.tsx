import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Desktop } from "./desktop/index.ts";
import { NativeProcessHost } from "./process/index.ts";
import { Shell } from "./shell/index.ts";
import { NativeWindow, WindowLayer } from "./windowing/index.ts";
import { createPlasmonServices, type PlasmonServices } from "./integration/services.ts";

export interface PlasmonOSProps {
  services?: PlasmonServices;
}

function isImageRef(value: string): boolean {
  return /^(?:https?:|data:image\/|\/|\.\.?\/)/u.test(value);
}

function windowIcon(icon: string, title: string): ReactNode {
  if (!icon) return null;
  if (isImageRef(icon)) return <img src={icon} alt="" draggable={false} />;
  return <span aria-label={title}>{icon}</span>;
}

/**
 * Integration-owned Wave 2 composition root. Native applications render in
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
    <Shell
      process={services.process}
      windows={services.windows}
      fs={services.fs}
      fsEvents={services.fsEvents}
      neutron={services.neutron}
      nativeApps={services.nativeApps}
      filesystemOpen={services.filesystem.open}
      openService={services.openService}
    >
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
              return (
                <NativeWindow
                  key={state.id}
                  state={state}
                  manager={services.windows}
                  title={title}
                  icon={record ? windowIcon(record.icon, title) : null}
                  active={active}
                  onRequestClose={(_windowId, processId) => services.process.close(processId)}
                >
                  {record ? (
                    <NativeProcessHost
                      processId={record.id}
                      registry={services.nativeApps}
                      process={services.process}
                      fs={services.fs}
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
    </Shell>
  );
}
