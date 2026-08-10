import { useEffect } from "react";
import type {
  AssociationRegistry,
  FsEventSource,
  FsService,
  OpenService,
  OpenTarget,
  ProcessController,
  ProcessId,
} from "../../os/contracts/index.ts";
import { PropertiesPanel } from "../../os/file-manager/index.ts";

export interface PropertiesAppProps {
  processId: ProcessId;
  target: OpenTarget;
  fs: FsService;
  process: ProcessController;
  fsEvents?: FsEventSource;
  associations: AssociationRegistry;
  openService: OpenService;
}

export function PropertiesApp({
  processId,
  target,
  fs,
  process,
  fsEvents,
  associations,
  openService,
}: PropertiesAppProps) {
  useEffect(() => {
    if (!target.nodeId) return;
    let active = true;
    void fs.stat(target.nodeId)
      .then((node) => { if (active) process.setTitle(processId, `${node.name} Properties`); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [fs, process, processId, target.nodeId]);

  if (!target.nodeId) {
    return <section className="native-properties-app"><p className="fm-error" role="alert">Properties requires a filesystem resource.</p></section>;
  }

  return (
    <section className="native-properties-app">
      <PropertiesPanel
        nodeId={target.nodeId}
        fs={fs}
        {...(fsEvents ? { fsEvents } : {})}
        registry={associations}
        openService={openService}
      />
    </section>
  );
}
