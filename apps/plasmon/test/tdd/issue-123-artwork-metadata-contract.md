# #123 artwork metadata contract

Artwork is presentation metadata attached to a stable game resource identity,
not execution authority. Candidate accepted sources are bounded package-local
asset metadata or explicit filesystem metadata imported with a legal fixture;
remote cover lookup and filename/game-title tables are forbidden. Rename/move
preserves identity; copies require explicit metadata-copy policy; missing,
invalid MIME, oversized, failed or inaccessible artwork falls back to shared
ResourcePresentation without changing association/open behavior.

#190 must provide the shared asset/presentation seam; #121 provides legal
fixture context. Exact metadata key/byte envelope remains UNSPECIFIED until
those dependencies integrate.
