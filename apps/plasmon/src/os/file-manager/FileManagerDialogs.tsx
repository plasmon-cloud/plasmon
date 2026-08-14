import type { PointerEvent as ReactPointerEvent } from "react";
import type {
  AssociationRegistry,
  FsEventSource,
  FsNode,
  FsService,
  OpenService,
} from "../contracts/index.ts";
import { OpenWithPanel, PropertiesPanel } from "./properties.tsx";

interface FileManagerDialogsProps {
  fs: FsService;
  fsEvents?: FsEventSource;
  associations?: AssociationRegistry;
  openService?: OpenService;
  openWithNode: FsNode | null;
  propertiesNode: FsNode | null;
  onCloseOpenWith: () => void;
  onCloseProperties: () => void;
  onChanged: () => void;
}

export function FileManagerDialogs(props: FileManagerDialogsProps) {
  const { associations, openService } = props;
  return (
    <>
      {props.openWithNode && associations && openService ? (
        <OpenWithPanel
          fs={props.fs}
          node={props.openWithNode}
          registry={associations}
          openService={openService}
          onClose={props.onCloseOpenWith}
          onChanged={props.onChanged}
        />
      ) : null}
      {props.propertiesNode && associations && openService ? (
        <div
          className="fm-modal-backdrop"
          role="presentation"
          onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
            if (event.target === event.currentTarget) props.onCloseProperties();
          }}
        >
          <section className="fm-dialog fm-dialog--properties" role="dialog" aria-modal="true">
            <PropertiesPanel
              nodeId={props.propertiesNode.id}
              fs={props.fs}
              {...(props.fsEvents ? { fsEvents: props.fsEvents } : {})}
              registry={associations}
              openService={openService}
              onClose={props.onCloseProperties}
            />
          </section>
        </div>
      ) : null}
    </>
  );
}
