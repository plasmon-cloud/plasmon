# Issue #43 — snap/unsnap pointer continuity contract

Status: **BROWSER SPEC ONLY / CHARACTERIZATION READY**. Manager snap geometry is
already covered by pure tests; pointer continuity is a real browser boundary.

## Required evidence

For a titlebar drag, record:

1. pointer coordinates at `pointerdown`;
2. pre-transition authoritative window rect;
3. pointer coordinates at edge threshold and release;
4. post-snap authoritative rect and snap side;
5. titlebar grab-point offset from the window rect;
6. pointerdown/drag coordinates after beginning a drag from snapped state;
7. unsnapped rect and grab offset;
8. pointer capture/cancel/release state.

## Cases

- free drag commits through WindowManager;
- left-edge release enters left snap;
- right-edge release enters right snap;
- snapped state preserves restore geometry;
- begin drag from snapped restores same window and maintains a coherent grab
  offset rather than jumping under the pointer;
- release away from edge returns floating geometry;
- resnap works after unsnap;
- pointer cancel/lost capture restores authoritative manager geometry and cleans
  selection/iframe suppression;
- focus/z-order remains manager-owned.

Use relative relationships and measured rectangles, not “window moved” or magic
edge pixel assertions. The threshold may be implementation-defined and should be
validated by the observed edge gesture, not asserted as a CSS constant.
