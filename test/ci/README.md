# Repository CI test tooling

`test/ci/` contains deterministic validators and orchestration helpers for repository CI contracts. It owns classification and verification of required workflows, Plasmon test inventory, browser gate semantics, and flake-probe evidence.

These scripts validate structural or execution contracts; they do not replace product tests, package tests, browser acceptance, or manual review. Keep them filesystem/Git/Node/Bun-level where their contract permits and route product failures to the owning workspace.
