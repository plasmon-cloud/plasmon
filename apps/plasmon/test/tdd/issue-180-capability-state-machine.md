# #180 Photos Expand capability state machine

```text
normal -> request capability
  fullscreen available + request succeeds -> browser-fullscreen
  disabled/rejected -> expanded-workspace + visible notice
expanded-workspace -> restore -> normal prior Photos view/window state
browser-fullscreen -> exit succeeds -> normal
browser-fullscreen -> exit rejected -> visible actionable notice; no unhandled rejection
```

Photos remains subject to Neutron sandbox/FeaturePolicy and Windowing geometry.
Expand must not add permissions, `allow-same-origin`, a fixed overlay that
bypasses Windowing, or silent Promise rejection. Image fit/zoom/pan state remains
coherent through mode transitions. Deterministic helper tests already prove
capability/rejection handling; only real installed policy can prove workspace
presentation and absence of pageerror.
