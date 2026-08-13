# #114 preview state machine

```text
mode=edit  -> editor visible, preview absent
mode=split -> editor + preview visible
mode=preview -> preview visible, editor absent
source edit -> same document session dirty + preview derives current source
malformed source -> safe renderer output/error, no editor/session corruption
save/close -> shared DocumentSession/Process semantics
```

The existing renderer sanitizes parser output and rejects unsafe hrefs. It does
not prove live DOM/preview geometry or formatter behavior; those are separate
RTL/browser criteria.
