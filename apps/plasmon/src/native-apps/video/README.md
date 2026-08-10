# Native Video Player

Local videos are read once through `FsService` into a `Blob`; object URLs are revoked on target change/unmount and bytes are never base64 encoded into React state. HTTP(S) media is used directly. YouTube handling parses a validated public URL to a video ID and uses the privacy-enhanced embed domain. There is no authenticated Neutron surface handling.
