# #202 no-security-regression test plan

Before/after installed test records sandbox attributes, CSP/security headers,
first-party request locality, frame origin behavior, and absence of
`allow-same-origin` additions. It opens the game through normal FS ->
AssociationRegistry -> OpenService and observes real player/canvas readiness.
It fails on both exact #202 errors and any new SecurityError/CSP/ORB/remote
request. It then runs strict #187 with only unrelated allowances and confirms
both #202 rules can be removed. No mocked StorageManager or hidden console
listener counts as proof.
