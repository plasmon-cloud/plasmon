# Native/runtime documentation accuracy audit

| document | current accuracy | stale/clarify |
|---|---|---|
| `src/native-apps/README.md` | accurately separates apps/runtime hosts and layers | #179 default-off is not yet integrated; note packet only |
| Text README | accurately describes Monaco/session/close | autosave currently still forced; #179 contradiction is known RED |
| Markdown README | describes shared editor/preview | formatter/command work absent (#114) |
| Photos README | classification/object URL/fullscreen boundaries accurate | packaged denied-policy proof absent |
| Video README | codec/browser boundary accurate | no complete browser acceptance yet |
| Browser README | URL/iframe/security boundaries accurate | navigation scope intentionally narrow |
| js-dos README | Program Files vs transport, no `.sys`, browser testing accurate | #64 save API absent; #202 errors remain |
| EmulatorJS README | host/iframe/assets/persistence boundaries accurate | first NES slice intentionally no durable saves |
| Games architecture doc | correctly rejects `.sys` wrappers and basename saves | many future save/artwork items remain |
| Review README/AGENTS | standalone Atom/revision/portability boundaries accurate | installed/visual evidence remains #58/#170 |

TDD planning artifacts record required updates; production README changes are
not made by this specification lane.
