# Native-app offline package contract

First-party app chrome, icons, Monaco workers, js-dos/EmulatorJS scripts/WASM,
legal fixtures, and CSS must resolve from installed package-local paths. Browser
URLs may use a transport mirror, but no runtime may require internet CDN assets.
Review's standalone package similarly uses its own package and Neutron Files
boundary; external sharing is not an MVP dependency.

Permanent package evidence: native app metafile guard, `test/package.test.ts`,
EmulatorJS/js-dos asset equality checks, fixture byte checks, Review package
validation/attestation. Missing browser evidence: actual installed request
health and runtime startup for each host. Remote URL appearance in runtime
metadata may document upstream provenance but must not be a fetch dependency.
