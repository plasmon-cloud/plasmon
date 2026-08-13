# Monaco host non-authority list

The shared host must not own:

- FsService reads/writes, NodeId allocation, rename, Save As, or persistence;
- DocumentSession loading, dirty/autosave/conflict state;
- Process open/close/focus or WindowManager lifecycle;
- dirty-close Save/Discard/Cancel negotiation;
- Markdown parsing, sanitization, preview links, or split-pane mode;
- association/open handler selection;
- global extension/MIME classification (owned by #178 canonical seam);
- package/runtime worker root selection beyond consuming #89's accepted config;
- application-specific toolbar/status semantics;
- a global model registry policy that can dispose unrelated surfaces.

## #113/#114 ownership boundary

#113 Text retains editor desktop/editor chrome parity, commands, save/status
presentation and Text-specific controls outside the host. #114 Markdown retains
formatter/preview/split mode and command affordances outside the host. Both may
consume shared editor commands/chrome only through accepted common contracts.

## Failure rule

Worker/bootstrap failure and editor initialization failure must be explicit host
states. No silent plaintext/fake editor fallback may hide a package/security
failure unless an existing canonical app policy explicitly permits it.
