# Properties

<!-- plasmon-docs-review:v1 sha256=4d3ff9ffc478ab4337cee20ab1ec41e0e32e322668c0ec559da36a161e87ee2a base=0c9f91b341800f91113aeb269a6438165eb825c8 -->

Properties is the native application wrapper for shared filesystem/resource inspection.

`PropertiesApp.tsx` is primarily presentation. Resource path/type/content/default-handler/logical metadata should be derived from filesystem and association services so Properties agrees with FileManager, Search, and opening behavior.

Do not duplicate resource classification or association matching inside this application. Changes to shared semantics should flow into Properties through the owning service/model.

## Refactor direction

Keep Properties thin and reusable: move inspection/formatting models into shared FileManager/resource metadata code when multiple surfaces need them. Add app-specific presentation only where a dedicated Properties window genuinely needs different UI.

## Testing

Use fast tests for shared inspection/formatting models and association/resource metadata. Use browser tests for the native window/presentation only when focus, selection/copy, dialog, or rendered layout behavior is material.
