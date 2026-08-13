# #58 persistence contract

Review provider persistence stores normalized Atom metadata, item/comment
records, revision journal, sparse checkpoints, and command receipts. Current
state reconstruction is independent of source path and revision representation.
Small mutations update changed records; restore replaces current normalized
records and writes a new revision/checkpoint. IndexedDB database is
`neutron-review-v1`; the browser package owns the persistent background
capability boundary, not Plasmon foreground storage.

Required installed validation: create -> semantic edits -> reload/reopen -> both
Atoms and current revision/history remain; export/import creates a distinct Atom
while retaining source provenance. Corrupt/missing history is represented by
`HISTORY_INCOMPLETE` rather than silent state invention. No schema migration is
claimed by this audit.
