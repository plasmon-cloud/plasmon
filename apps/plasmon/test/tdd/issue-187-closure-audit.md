# #187 native/runtime health closure audit

PR188 is merged and the shared browser-health ledger is present. The current
strict smoke intentionally has narrow allowances for Monaco (#67/#200),
js-dos storage (#202), asset URL defects (#190), and environment diagnostics.
This is not permission to turn any allow rule into a product pass.

For Luna-C: #187's own durable contract is the observer and exact scoped
allowance behavior. Native app gates must consume it and retire only their own
rules after owner fixes. #67/#89 require Worker health; #180 requires denied
fullscreen without pageerror; #202 requires both storage errors gone. Status:
CLOSURE AUDIT; Testing/Integration remains primary owner.
