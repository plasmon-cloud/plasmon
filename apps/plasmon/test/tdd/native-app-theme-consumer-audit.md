# Native-app theme consumer audit

Current code mixes shared `editorChrome` values with app-local inline dark
colors. Review uses its own explicit dark/light-capable CSS. Settings and
Browser/Photos/Video have hardcoded dark panels; Explorer/Recycle Bin consume
separate stylesheets. This is a characterization finding for #112/#201, not a
new visual RED without accepted light/dark criteria.

Potential risk rows: Text/Markdown input placeholder and editor panel contrast;
Photos/Video error/status text against dark backgrounds; Browser address/iframe
boundary; Settings unavailable messages; Recycle Bin table/banner states;
Review first-demo theme is #170. Validate with semantic contrast/manual package
review rather than screenshot-only or pixel tests. Do not alter product tokens
in this TDD lane.
