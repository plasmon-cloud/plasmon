# Issue #176 — context ownership characterization

Classification: **FINAL RTL RED PACKET — PRODUCTION EVENT POLICY SEAM REQUIRED**.

See `issue-176-final-packet.md` and `issue-176.red.ui.test.tsx` for the
current executable gate. This matrix is retained as authority reconnaissance.

No deterministic first-party event-policy model currently exists below React.
Current specialized FileManager/Shell/native handlers own local events, but a
Luna-only global interceptor would create a second authority and could break
Browser/Neutron/iframe content. Do not add that interceptor in the TDD lane.

## Ownership matrix

| Surface | Owner | Expected right-click result | Foreign/editable exception |
|---|---|---|---|
| Desktop background | Desktop/FileManager | browser menu suppressed; minimal Plasmon fallback or specialized background menu | none |
| FileManager entry | FileManager | resource context menu; selected/unselected policy remains canonical | entry labels must not become browser drag/text surfaces |
| FileManager blank area | FileManager | background menu or minimal fallback | diagnostic text remains selectable under #86 |
| Favorites/sidebar | Explorer/FileManager adapter | navigation/sidebar menu or minimal fallback | editable address/search inputs retain deliberate native/editor behavior |
| taskbar | Shell/taskbar | specialized task/pin menu | embedded foreign content is not a taskbar surface |
| first-party native chrome/content | owning native app | app-specific menu or minimal fallback | Monaco/editor/textarea may expose intentional editor operations |
| Browser app content | Browser/native app | browser/content semantics remain intentional | do not globally suppress legitimate link/text/image menu |
| foreign/Neutron iframe | Kernel/foreign app boundary | not intercepted by Plasmon document listeners | preserve app/iframe context and sandbox/security policy |

## Required production seam (future implementor)

Expose a narrow ownership decision at the adapter boundary, e.g. an event-policy
input that can answer surface ownership and whether a specialized handler
already claimed the event. The exact API belongs to the implementation owner;
this packet does not freeze names. The seam must preserve composed bubbling,
keyboard Escape dismissal, focus, accessibility, and editable-control policy.

## Representative Playwright propagation matrix

For each row run with a real packaged app and record `defaultPrevented`, visible
menu role/name, event target surface, propagation outcome, and whether the
foreign frame received the event:

1. Desktop blank -> Plasmon fallback, no browser menu.
2. FileManager selected entry -> resource menu, no duplicate fallback.
3. FileManager blank -> background/minimal menu.
4. Favorites button -> sidebar menu/navigation policy.
5. taskbar running window -> task menu.
6. first-party native app chrome -> app/fallback menu.
7. Monaco/editor textarea -> deliberate editor menu/selection behavior.
8. Browser app link/text/image -> Browser-owned behavior remains available.
9. installed Neutron iframe -> foreign context remains available and no parent
   interception is observed.
10. Escape and keyboard dismissal close any Plasmon menu without leaking a
    second browser menu.

A browser gate should use event listeners only as observation instrumentation,
not as a production policy substitute. The lower deterministic policy guards remain green, while the staged RTL gate
now exercises the existing production DOM boundary. The intentional RED is the
editable FileManager rename target being prevented by the outer handler; the
foreign/owned characterization remains green. No global interceptor is added.
