# #96 native application identity assets characterization

**Disposition: FINAL IMPLEMENTOR PACKET READY — core RED + package boundary remainder (post-#190).**
`content-apps.ts` still defines six user-launchable first-party handlers/apps
whose canonical identity values are generated SVG data URIs: Text, Markdown,
Photos, Video, Browser, and Settings. The #190 candidate does not change those
metadata values.

#190 now supplies the accepted `ResourceIcon`/resolved-presentation consumer,
package-relative shared asset vocabulary, deterministic application fallback,
and migrated Start/Search/taskbar/FileManager/Properties/Open With consumers.
Therefore #96 must not add consumer maps or retest general resource
presentation. It owns replacing only the six canonical metadata references with
stable package-owned offline identity references, retaining IDs and association
semantics. Runtime-only js-dos/EmulatorJS hosts remain outside this gate.

The executable `.red/issue-96.red.test.ts` fails on the current generated
metadata and also requires each future reference to resolve to an existing
package asset. Existing #190 installed asset coverage is the appropriate
packaged URL/offline remainder; no screenshot or artwork-pixel contract is
needed here. Accessibility labels remain independent semantic metadata.
