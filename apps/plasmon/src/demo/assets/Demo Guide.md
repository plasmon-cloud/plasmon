# Plasmon Demo Guide

Welcome to the **Plasmon demo environment**. This document is a real Markdown file shipped with `plasmon:demo` so the Markdown editor has representative content to open, edit, save, and search.

## Try these workflows

- [ ] Open this file from its Desktop shortcut.
- [ ] Edit a heading and save it.
- [ ] Find this document with Search.
- [ ] Browse to it through **FileManager → Documents**.
- [ ] Open `Demo Artwork.svg` in Photos.

## Demo resources

| Resource | Location | Opens with |
| --- | --- | --- |
| Demo Notes.txt | `/Documents` | Text |
| Demo Guide.md | `/Documents` | Markdown |
| Demo Artwork.svg | `/Pictures` | Photos |

> Demo content is selected by the `plasmon:demo` deployment. It does not depend on browser query parameters.

### Example code block

```ts
const environment = "plasmon:demo";
const resources = ["Demo Notes.txt", "Demo Guide.md", "Demo Artwork.svg"];
```

---

All content in this file is authored in the Plasmon repository and is safe to redistribute with the demo package.
