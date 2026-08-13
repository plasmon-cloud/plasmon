
## Overnight queue revisit

No architecture-dependent #196 RED was added. #195 remains characterization-only
and no implementation seam has landed. Keep the existing recommendation:
finalize view strategy/layout/navigation gates only after #195 exposes the
surviving adapter and view inputs.
