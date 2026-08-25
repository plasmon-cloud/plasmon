# Canonical Luna promotion manifest

This directory is the repository source of truth for the normalized Luna A/B/C/D promotion corpus owned by Issue #368. It records governance and regression evidence; it does not replace Product Issues, restoration Issues, GitHub dependency state, or browser-health policy.

## Read order

1. `manifest.meta` defines the schema, target release, exact certification SHA, fragment order, and stable-ID migrations.
2. `stable-ids.txt` locks the 128 active stable gate IDs so an entry cannot silently disappear or be renamed without an explicit migration.
3. `lane-a.tsv`, `lane-b.tsv`, `lane-c.tsv`, and `lane-d.tsv` contain the normalized live/historical lane contracts.
4. `invalid.tsv` contains the deduplicated intentionally removed, invalid, or superseded packet identities required by the 105-to-128 corpus correction.
5. `test/ci/verify-luna-promotion-manifest.mjs` validates the assembled manifest against current repository evidence, required browser inventory, live GitHub Issue state, stable IDs, and the exact certification input.
6. `test/ci/verify-luna-promotion-manifest.test.mjs` exercises the required deterministic failure modes.

All TSV fragments use the same columns: stable gate ID, Luna lane, source Issue, source artifact, source kind, original-D42 membership, current classification, evidence/replacement path, required CI lane, owner/restoration Issue, rationale, exact certified release SHA, and the narrow #305 BrowserHealth policy fields where applicable.

`PENDING` entries must point to an open canonical owner Issue. `QUARANTINED` entries must point to an open dedicated restoration Issue. Terminal `PERMANENT`, `EQUIVALENT`, and `PACKAGED` entries must point to evidence that exists in the current repository. `PACKAGED` evidence must be reachable from the required smoke, specialist, or persistence inventory rather than merely existing as an optional browser file. `SUPERSEDED` entries require an explicit rationale and replacement or owner.

The seven historical Luna browser-restoration identities (#251, #279, #303, #304, #308, #320, and #330) remain stable manifest identities. A restoration that is still open must remain `QUARANTINED`; a closed restoration must be represented as required `PACKAGED` evidence. #305 is separate terminal `PERMANENT` BrowserHealth policy evidence and is never counted as an active test quarantine.

The verifier runs in required Plasmon Fast CI. On pull requests it validates `certificationReleaseSha` against the actual PR base SHA; on release pushes it validates against the pushed release SHA. This prevents certification from being copied forward from stale audit prose.

Private coordinator or workspace tooling, including `status.sh`, is outside this source-of-truth boundary and is neither read nor required by the manifest or verifier.
