# Dependencies

No new runtime or development packages are required.

The Atom package reader/writer is implemented with platform primitives (`TextEncoder`, `TextDecoder`, typed arrays, Web Streams/`DecompressionStream` when available) so Agent 2 does not require shared `package.json`, lockfile, build, manifest, or capability changes.
