# Kernel CI required-check skip example

This file exists only to validate PR #335.

The parent branch contains the Kernel CI job-level applicability change. This child PR changes only `doc/**`, which the existing Kernel scope policy classifies as not Kernel-relevant.

Expected GitHub Actions behavior:

- `Determine Kernel CI applicability` runs and succeeds;
- the exact required job `kernel` is instantiated and shown as **skipped**;
- no Nix install, Kernel package, or Kernel test work runs in the `kernel` job.

Close this disposable PR after validation.
