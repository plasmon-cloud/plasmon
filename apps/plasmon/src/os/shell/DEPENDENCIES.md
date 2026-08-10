# Shell shared dependency requests

No contract amendment or package dependency is required.

Coordinator A integration will need to supply the already-frozen contract-typed services that are not currently exposed by `createPlasmonServices()`:

- `NativeAppRegistry` containing Agent 7 built-ins;
- `AssociationRegistry`;
- `OpenService` for generic file/Atom search-result dispatch.

`Shell` accepts all three by injection and does not import their implementations. `AssociationRegistry` and `OpenService` are optional at the component boundary so the OS remains bootable during staged integration; attempting to open a filesystem search result without them produces a bounded visible error rather than guessing a handler.

Coordinator A should compose `Shell` around the accepted Desktop and `WindowLayer` from the integration-owned `PlasmonOS.tsx`. No Neutron iframe/tray portal wiring belongs in Plasmon Shell.
