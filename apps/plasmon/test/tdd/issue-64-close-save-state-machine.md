# #64 close/save state machine

```text
ready game -> runtime progress
  explicit save (if supported) -> export pending -> FS commit -> saved/ready
  close -> request engine export with bounded lifecycle
    export success -> FS commit -> stop -> close
    export unavailable -> close with explicit no-save result (policy required)
    export failure -> preserve game/source; report warning/error; close policy required
reopen -> locate by NodeId -> validate runtime/version/checksum
  compatible -> import -> ready
  missing/corrupt/incompatible -> normal fresh startup + visible warning
```

Do not block Process close indefinitely, silently lose a confirmed save, or
make failed screenshot capture (future #124) block the authoritative save.
Exact UI decision on failed export remains an Issue acceptance question.
