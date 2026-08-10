# Sharing integration dependencies

Phase A adds no npm/Mops/package dependencies and does not require lockfile changes.

The provider does require the following Plasmon backend/manifest wiring so its storage survives upgrades and can be reached through Neutron same-AppScope self-calls:

- `backend/memory/sharing/v1.mo` — new immutable stable-memory schema v1;
- `backend/sharing/Sha256.mo` — backend SHA-256/content-root verification;
- `backend/main.mo` — sharing storage methods and `stable_memory.sharing` environment root;
- `neutron.json` — declares the sharing memory root and backend methods.

These are integration-affecting edits required by the explicitly assigned stable-memory provider work. No shared package or lock files are modified.

Phase B will additionally require Agent 0/Agent 8 integration of the final MTN 0.2 authorization API. Do not add MTN dependencies or authorization contracts here before that handoff.
