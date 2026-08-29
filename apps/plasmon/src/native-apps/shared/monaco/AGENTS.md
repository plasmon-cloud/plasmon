# Shared Monaco Adapter Instructions

This directory is a browser/editor adapter boundary, not a document authority.

## Own here

- Monaco editor/model creation and disposal
- per-live-surface Monaco model ownership
- Monaco worker environment installation using the canonical packaged runtime seam
- editor loading/ready/error state
- browser-bound focus/layout/value/language synchronization
- deterministic Monaco model/language/worker policy tests

## Do not own here

- filesystem persistence or resource identity
- document dirty/conflict/save/autosave policy
- Process close negotiation
- Text or Markdown commands/chrome
- Markdown preview/rendering
- a second worker/package path or application catalog

Consume canonical resource classification and the canonical Program Files worker runtime. Keep real sandbox/worker claims in packaged browser acceptance.
