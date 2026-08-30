# Plasmon staged CI lifecycle

The CI lifecycle is intentionally simple:

> **Approval-stage CI decides whether the change is correct enough to merge. Pressing Merge means the user has committed to merging it. The merge queue is only a fast final integration checkpoint, not a second slow test phase. Post-merge probing watches for flakiness without making the user wait to finish the merge.**

## Canonical lifecycle

```text
PR opened / updated
→ FAST tests

Reviewer approves
→ full pre-merge confidence gate
   → every required non-quarantined acceptance runs once
   → 1 broad Flake Probe observation
   → impacted Playwright scope runs 3×, retry-free, in one prepared targeted packet

All green
→ Merge becomes available

User presses Merge
→ the change is committed to merging
→ PR enters merge queue

Merge queue
→ FAST tests only
→ expensive package/PocketIC/Playwright gates report their stable required contexts without rerunning slow work

Clean
→ GitHub merges automatically

Failure
→ investigate the integration failure

After merge
→ 3 broad retry-free observations
→ conditional 3 targeted retry-free characterization observations
```

## Why the queue is fast

The queue protects the final integration ordering and synthetic merge-group commit. It must not become another long developer wait. The normal required browser and Kernel contexts therefore do not repeat their expensive workloads in `merge_group`; `Fast Bun tests` remains the real queue test workload.

## Flake setup policy

The conditional targeted 3-observation characterization uses one prepared packet/setup.

The 3 broad post-merge observations currently remain independent prepared environments because broad shared-state reuse has not yet been proven safe. The PocketIC/setup optimization work owns proving whether those three observations can safely share one setup; the staged CI policy must not wait for that optimization.

## Explicit diagnostics

`ci:flake-probe` remains the deliberate heavy targeted diagnostic mechanism. `ci:flaky` remains classification/debt metadata and does not trigger the heavy probe.

Profile-specific Playwright characterization must use a package profile that can truthfully execute the selected acceptance. Quarantine remains exact-test scoped through the fixed `@quarantine` marker, and all probe evidence remains retry-free.

See [`README.md`](./README.md) for required-status ownership and [`PLASMON_FLAKE_PROBE.md`](./PLASMON_FLAKE_PROBE.md) for the detailed evidence model.
