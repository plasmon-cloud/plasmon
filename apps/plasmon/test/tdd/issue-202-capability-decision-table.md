# #202 capability decision table

| option | sandbox | CSP/local assets | persistence risk | status |
|---|---|---|---|---|
| grant `allow-same-origin` | weakens isolation | may mask failure | browser storage becomes tempting | FORBIDDEN |
| global permission/CSP change | broadens authority | changes package policy | unrelated apps affected | FORBIDDEN |
| vendor capability detection | preserves | local | can graceful-degrade | candidate |
| host adapter before Dos | preserves if narrow | local | must not fake storage | candidate |
| graceful optional storage disable | preserves | local | no durable progress claim | candidate |
| random vendor patch | unknown | may alter bytes/licensing | unsafe regression surface | not acceptable without audit |
| error suppression/health allowlist | preserves falsely | local | hides bug | FORBIDDEN |

Future acceptance requires real player/canvas readiness and no exact #202 errors,
while preserving local-assets-only and unchanged sandbox.
