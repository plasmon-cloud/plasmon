# #179 save state machine

```text
ready + edit -> dirty/ready
 dirty + autosave OFF + debounce elapsed -> dirty/ready, bytes unchanged
 dirty + explicit Save -> saving -> ready/clean on success
 dirty + Save failure/conflict -> error/conflict + dirty (bytes unchanged)
 dirty + close -> canonical Process negotiation
   Save -> successful save then close
   Discard -> close, no save and no dispose flush
   Cancel -> session remains open/dirty; timer policy resumes
```

Autosave ON is a separate branch: preference opt-in -> bounded debounce -> the
same `saving`/success/error/conflict transitions. It never bypasses conflict
checks or recreates the model. Text and Markdown must traverse the same policy.

Required deterministic cases are default Text and Markdown, save failure,
conflict, dirty close and discard. RTL adds only visible dirty/save affordance
and preference wiring. Monaco browser tests are unnecessary for byte/dirty
semantics.
