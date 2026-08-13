# EmulatorJS lifecycle coverage

| phase | current evidence | missing/permanent destination |
|---|---|---|
| association/open/process/window | `emulatorJsRuntime.test.ts` | current permanent |
| ROM header/size rejection | `emulatorjs.test.ts` | current permanent |
| host URL/token | runtime tests/package | current permanent |
| host/loader/game readiness | packaged `plasmon-emulatorjs-proof.spec.ts` | rerun current release |
| package-local asset completeness | `package.test.ts` | current permanent + browser health |
| input/audio/fullscreen | source/runtime docs only | packaged/manual browser |
| close/terminate/iframe cleanup | host source; no direct browser teardown assertion | RED promotion gap |
| save | README explicitly does not claim for legal NES fixture | separate future Issue; do not invent generic save |
