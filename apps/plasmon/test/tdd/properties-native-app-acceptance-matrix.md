# Properties native-app acceptance matrix

| resource | required property behavior | authority/evidence | gap |
|---|---|---|---|
| ordinary file/folder | NodeId/name/path/size/type/modified | FileManager Properties tests | packaged visual |
| renamed/moved | current path/name through NodeId | FS tests | mounted app refresh |
| `.sys` | canonical system metadata/app identity | resource policy/Properties tests | no duplicate catalog |
| `.neutron` | projection metadata/handler | Neutron projection tests | installed visual |
| shortcut | target identity/display | shortcut/file icon tests | stale target visual |
| missing/stale | explicit alert, no fake properties | component branch | RTL |
| icon/MIME | shared classifier/presentation | #178/#190 | dependencies |
| close | normal Process/Window close | process tests | RTL adapter |

This characterizes the native Properties wrapper without duplicating A-owned
FileManager commands or classifier implementation.
