# Hullshift

Hullshift is a first-party deterministic GPU-rendered sci-fi pushing-puzzle application for Neutron. Its frontend and bundled runtime assets live under `src/` and `public/`; its brain/controller and replay-oriented checks live under `tools/`, `scripts/`, and `test_brain/`.

Use `npm run verify` for type, brain, and catalog checks and `npm run package` for the production archive. The game owns its application presentation and simulation; Neutron remains authoritative for package execution, capabilities, and security.
