# #124 preview authority contract

A screenshot is a non-authoritative preview associated with the accepted #64
save resource. Save correctness, runtime payload, NodeId and schema/version are
independent. Capture occurs only at an explicit successful save boundary or
runtime-supported snapshot event. Preview may be missing/stale/replaced and
must fall back without blocking or corrupting authoritative save data.
