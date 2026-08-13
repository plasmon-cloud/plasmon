# #184 acceptance map

| criterion | authority | observable | layer | current evidence | final status |
|---|---|---|---|---|---|
| TaskManager.sys canonical resource/application | managed system app registry + FS reconciliation | `/System/TaskManager.sys` exists with system-app metadata and registered native handler | headless | `issue-184.red.test.ts` fails: path absent | HEADLESS RED |
| one process appears once | Process/Window snapshots | one truthful row/group per canonical process | headless model | no TaskManager model exists | promotion target: `src/native-apps/task-manager/model.test.ts` |
| app/process/window identity truthful | Native definitions + ProcessRecord + WindowState | row keeps distinct IDs | headless | authority contracts exist | implementation required; no fake corpus |
| Focus/Switch | Process.focus → WindowManager.focus | selected row focuses/restores target | headless/RTL | Process focus tests pass | missing consumer |
| Close/End | Process.close | allow removes; dirty veto/defer preserves | headless/RTL | Process + DocumentClose tests pass | missing consumer |
| stale process disappears | WindowManager subscription reconciliation | closed window removes process/row | headless | Process tests and #81 gate pass | projection missing |
| taskbar opens TaskManager | filesystem open dispatcher → Process | one canonical native activation | RTL/browser | no context action | missing consumer |
| Search no Running duplication | Search model + #174 authority | no TaskManager-created runtime labels/catalog | headless | #174 active ownership | dependency; do not touch |
| metrics | Process contract | absent CPU/RAM fields remain absent | review | no authority exists | UNSPECIFIED / UNAVAILABLE |

No TaskManager API or process database is invented by this packet. Exact current failures are executable with `bun test ./apps/plasmon/test/tdd/.red/issue-184.red.test.ts`.
