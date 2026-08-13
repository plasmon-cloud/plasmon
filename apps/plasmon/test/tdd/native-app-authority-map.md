# Native-app authority map

```text
FsService / stable NodeId
  -> canonical classification/MIME (#189/#178)
  -> AssociationRegistry
  -> OpenService
  -> ProcessController
  -> Windowing
  -> native app or runtime host
  -> browser API/runtime assets where required
```

| concern | owner | consumers |
|---|---|---|
| resource identity/bytes | FsService | all apps, Properties, FileManager |
| classification/language | canonical classifier | associations, Search, Properties, Text/Markdown |
| handler selection/open | AssociationRegistry/OpenService | Desktop/FileManager/Shell/native apps |
| process/window geometry | Process + Windowing | native app roots, taskbar |
| document model/save/dirty | DocumentSession + Process close handler | Text/Markdown |
| app presentation | individual native app + Visual primitives | content chrome |
| browser capability | browser adapter in app/runtime | Monaco, Photos, Video, Browser, runtimes |
| runtime files | managed Program Files + package transport adapter | Monaco/js-dos/EmulatorJS |
| game save bytes | future runtime persistence through FsService (#64) | runtime host, resource presentation |

Suspicious duplicate risks: Text extension language table versus canonical #178;
logical Program Files runtime root versus package-local browser mirror; Browser
foreign iframe content versus Plasmon chrome; runtime canvas readiness versus
runtime storage health. No app may create a second filesystem, association
catalog, process registry, or fake `.sys` runtime identity.
