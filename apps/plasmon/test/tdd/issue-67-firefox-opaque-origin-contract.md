# #67 Firefox opaque-origin contract

Firefox must open installed Text/Markdown in the unchanged Neutron opaque-origin
sandbox and create the editor plus one language Worker without
`moz-nullprincipal` SecurityError. Observe Worker error events and browser
console/page errors; assert requested canonical package path and local 2xx.

Do not add `allow-same-origin`, change CSP, use a top-level worker, or accept
main-thread fallback as healthy. Current historical failure is the expected RED;
future GREEN retires only the exact #67/#89 allowance.
