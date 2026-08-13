# r2 cross-surface journey coverage

| journey | proven layers | missing boundary |
|---|---|---|
| create resource → Desktop/FileManager → rename → Search → Properties → open → Process → Window → taskbar → Trash → restore | fs/FileManager, cross-surface, refactor, Trash, RTL smoke | no single giant test is needed; exact future Search/Taskbar render paths remain #193/#198 |
| native `.sys` → Search/Start/FileManager → canonical activation → Process/Window | bootstrap, shell projection/activation, refactor guards | #174 final Search packet and rendered future Shell surfaces |
| `.neutron` → projection → canonical Neutron activation | Review integration, refactor guards, packaged Review | installed browser proof belongs #167/#170 specialist |
| document → Text/Markdown → save/dirty → reopen | document, close, association, persistence tests | packaged Monaco worker and #179 opt-in UI |
| image/media → Photos/video → presentation | media/Visual tests and classifier | #180 viewport and packaged codecs are browser boundaries |
| game fixture → js-dos/EmulatorJS → persistence | #121 demo fixture and runtime tests | #202 sandbox storage and #124 screenshots |

Coverage is mapped by lowest truthful layer. No owner should close a journey merely because another surface's shared authority test passes.
