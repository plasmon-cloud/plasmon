# Properties / Open With native-surface audit

Properties presentation is native-app-owned (`PropertiesApp`) but metadata and
handler selection remain shared `FsService`, classifier, AssociationRegistry
and OpenService authority. Open With is a FileManager/association surface, not
a second app catalog.

Required characterization: stable NodeId survives rename/move; canonical MIME
and classification display; missing target gives alert; shortcut shows target
identity/metadata; selected default handler is the registry result; activating
uses OpenService; no duplicate association authority. Current `PropertiesPanel`
and association tests provide lower evidence; #178/#190 dependencies own
classification/icon convergence. No independent unowned r2 native-surface
Issue was found, so no RED is staged.
