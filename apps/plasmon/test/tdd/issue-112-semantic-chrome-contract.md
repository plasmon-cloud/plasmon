# #112 semantic chrome contract

Common first-party content contracts to characterize, not force into one
component: application root has accessible name; command area is a toolbar/menu
when commands exist; loading/empty/error states use status/alert semantics;
status strip reports durable/user-relevant state; controls use shared theme
foreground/background/border tokens; focus remains visible; app-specific
content remains owned by its domain.

Text/Markdown share editor controls/status but Markdown preview remains specific.
Photos/Video share media surface conventions but native media controls/runtime
canvas remain specific. Browser iframe body is foreign. Explorer/Properties/
Recycle Bin retain FileManager/Trash semantics. Window title bar is Windowing,
not #112.

Disposition: **CHARACTERIZATION READY — NO HONEST STRUCTURAL RED**. Future
characterization tests should assert semantic roles/state and supported theme
readability, not wrapper names or CSS selectors.
