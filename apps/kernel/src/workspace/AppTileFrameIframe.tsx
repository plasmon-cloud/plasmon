import type { Ref } from "react";
import type { TileInstance } from "./types.ts";
import { APP_TILE_FRAME_SANDBOX } from "./app_tile_frame_policy.ts";

export function AppTileFrameIframe({
  tile,
  runtimeIdentity,
  src,
  iframeRef,
  onLoad,
}: {
  tile: TileInstance;
  runtimeIdentity: string;
  src: string;
  iframeRef: Ref<HTMLIFrameElement>;
  onLoad: () => void;
}) {
  return (
    <iframe
      key={`${tile.id}:${runtimeIdentity}`}
      ref={iframeRef}
      className="tile-iframe"
      data-tid="app-frame"
      data-app-id={tile.appId}
      data-tile-id={tile.tileId}
      data-instance-id={tile.id}
      onLoad={onLoad}
      sandbox={APP_TILE_FRAME_SANDBOX}
      src={src}
      title={tile.title}
      {...({ credentialless: "true" } as Record<string, string>)}
    />
  );
}
