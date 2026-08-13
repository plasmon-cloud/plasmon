# Native/runtime security boundary audit

| surface | preserve | allowed authority | forbidden workaround |
|---|---|---|---|
| Browser iframe | sandbox scripts/forms/popups, no same-origin | URL normalization/foreign content | same-origin grant/global context interception |
| Monaco Worker | opaque-origin/CSP/package-local workers | build/runtime path adapter | fake Worker/readiness, CSP weakening |
| js-dos | sandbox/local assets, optional capability handling | runtime host + FsService future save | storage permission/same-origin/vendor blind patch |
| EmulatorJS | child iframe/token/local assets, storage/wake-lock masked | real EJS lifecycle messages | direct contentDocument, storage authority, wake-lock grant |
| Photos fullscreen | FeaturePolicy/Windowing | expanded workspace fallback | fullscreen permission/fixed bypass |
| media | browser codec/iframe policy | object URL/native controls | transcoder fake/remote fallback |
| Review | vanilla Neutron AppScope/Files capability | provider persistence/Files | Plasmon/MTN shadow model |

This is a do-not-regress specification. Security errors must remain observable
when they represent required functionality; only exact optional capability
adaptation is acceptable.
