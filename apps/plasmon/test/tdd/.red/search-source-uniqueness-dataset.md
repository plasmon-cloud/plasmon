# Future Search source-uniqueness dataset

Status: **RECONNAISSANCE / WAIT FOR DEPENDENCY**. This dataset is a fixture
contract for #193 after #174/#190 and accepted #189 integrate. It intentionally
does not alter today's implementation packets.

| Fixture resource | Expected identity | Title | Category | Activation route | Presentation source | Forbidden duplicate aliases |
|---|---|---|---|---|---|---|
| one native `.sys` system resource | validated system `NodeId`/system handler identity, as accepted by #174 | canonical native app title | Apps | system-app/open service route | shared Visual/resource presentation | raw `node:<id>` plus native projection |
| one installed `.neutron` | Element id + projected NodeId relationship | Element name | Apps | Neutron bridge or accepted projection route | Element/Visual identity | separate `element:<id>` and projection aliases |
| ordinary document | `NodeId` | filename | Documents | filesystem opener/AssociationRegistry | canonical type/Visual fallback | duplicate extension-derived result |
| media file | `NodeId` | filename | Media | AssociationRegistry/media opener | Visual/media presentation | MIME and suffix duplicate |
| Start shortcut | shortcut NodeId + target identity | shortcut filename | Apps | shortcut dispatcher target | shortcut overlay + target presentation | target and shortcut both emitted as same user item unless accepted |
| Atom, if production fixture exists | Atom NodeId/resource identity | atom title/name | Atoms | atom/filesystem authority | atom Visual presentation | raw ordinary-file alias |

## Dataset invariants

- Every expected result has exactly one canonical visible identity.
- Search result keys are stable across category filtering and refresh.
- Display title/presentation can be enriched by a stronger live source but must
  not create a second result.
- Activation route is asserted by spies around real injected authority interfaces,
  not by checking a title or icon.
- The fixture must be created through real FsService/managed projection APIs or
  the accepted packaged fixture; no test-local `.sys`/`.neutron` policy.
- Missing/invalid metadata is a negative case: it must not be promoted to a
  system/Neutron application.

## Adoption gate

Do not convert this dataset into an executable RED until #174's accepted
projection contract and #190's asset/presentation contract are integrated on the
branch under test. Until then this is future evidence planning only.
