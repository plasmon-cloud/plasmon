# Review / Sharing boundary audit

Review MVP is standalone: `apps/review` imports `neutron-tools/app`, React,
fflate and its own engine/persistence/files port. It does not import Plasmon
packages, MTN, Yjs, or CRDT libraries. Its provider owns Atom semantics and
persistent state; Neutron Files is only the portability boundary.

Future sharing context from #38/#127: a read operation would require the
accepted `#read`/resource read capability, writes `#write`, and reshare
`#reshare`/authorization provider operations. Those are architectural future
boundaries, not Review MVP behavior. Do not add a shadow authorization model or
claim current Sharing provider tests as Review acceptance.

The current UI/documentation must communicate sharing unavailable/deferred
truthfully. #170 owns the visible first-demo wording; #58 owns standalone
model/package semantics.
