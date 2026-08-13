# #96 native application identity assets characterization

**Disposition: CHARACTERIZATION READY.** `content-apps.ts` defines stable
handler/app identities and package structural tests enumerate Text, Markdown,
Photos, Video, Browser, Settings, Explorer, Properties and Recycle Bin loader
inputs. Runtime-only js-dos/EmulatorJS hosts intentionally are not native `.sys`
applications.

Acceptance authority is package output plus NativeApplicationRegistry/Visual
identity consumption: each registered first-party app has a stable identity/icon
that resolves in packaged launch, Search/Start projections, and native window
chrome; missing asset fails explicitly; no runtime host receives a fabricated
`.sys` identity. Current evidence is structural package coverage and inline
handler icon metadata. Missing evidence is installed package asset/visual
resolution and a focused asset failure gate. Do not duplicate #190's shared
resource icon authority or #112's content chrome work.
