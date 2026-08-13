# Issue #186 — persistence boundary reconnaissance and executable plan

Classification: **RECONNAISSANCE**. No reproducible product data-loss evidence
exists in the current headless graph, and no dedicated Testing-lane ownership
was visible in the live queue during this pass.

## Survival matrix

| Journey | Should user data survive? | Authority | Honest automation | Origin/partition note |
|---|---:|---|---|---|
| FileManager close/reopen | Yes | FsService persistent repository/background storage | Bun/headless plus packaged open/close | same Plasmon app/Neutron tenant |
| Plasmon app reload/recomposition | Yes | FsService managed root and repository | packaged iframe/app reload | same installed app origin and authenticated tenant |
| page reload | Yes | background/service filesystem storage | Playwright page/iframe reload | same browser context/profile and site data |
| browser context close/reopen | Yes for supported persistence profile | browser persistent storage + Neutron authority | Playwright persistent context with same userDataDir | must reuse exact profile/storage partition; fresh context is not proof of loss |
| browser process restart | Yes for supported normal browser profile | browser storage lifecycle plus background service | automation only if launcher controls a persistent profile | Firefox/LibreWolf privacy settings may intentionally clear/isolate data |
| PocketIC process persistence | Not a user-data promise by itself; depends on deployed canister/storage | PocketIC canister state | deployment harness/process lifecycle | distinguish process restart from reinstall/reprovision |
| PocketIC reinstall | No; explicit reset may remove test state | provisioner/reinstall | provisioning commands | never label reinstall as browser persistence failure |
| explicit site-data clearing | No | browser policy | Playwright context clear/Firefox profile controls | expected destructive boundary |
| restrictive Firefox/LibreWolf privacy configuration | Only if configuration permits supported storage | browser policy | dedicated real-profile/manual evidence | document unsupported clearing/partition modes; no localStorage workaround |

## Smallest executable browser plan

1. Start one healthy PocketIC deployment and one persistent Chromium profile.
2. Authenticate once, launch installed Plasmon, create a uniquely named file and
   write bytes through the real FileManager path.
3. Record filesystem-visible path/NodeId/content hash through the UI or an
   allowed production-backed observation; do not inspect storage internals as a
   substitute for user behavior.
4. Close/reopen Explorer/FileManager and assert bytes remain.
5. Reload only the Plasmon frame/page and assert bytes remain.
6. Close the persistent browser context, reopen with the same profile directory,
   authenticate/launch, and assert the file remains.
7. Repeat in a fresh profile as a control; it must not be treated as continuity.
8. Run a deliberate site-data clearing control and assert the expected reset or
   recovery state, clearly separate from browser restart.
9. If Firefox/LibreWolf is supported, repeat with an explicitly persistence-safe
   profile and then with the reviewer privacy configuration; classify any reset
   as product, policy, or both with logs.

## Evidence rules

Do not declare #186 a product defect from headless persistence, a fresh context,
PocketIC reinstall, missing session JSON, browser crash, or a storage-security
tripwire alone. Preserve Neutron isolation and background filesystem ownership;
foreground localStorage is explicitly not an acceptable fix.
