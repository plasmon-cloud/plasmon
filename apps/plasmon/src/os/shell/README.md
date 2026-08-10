# Plasmon Shell

Wave 2 presentation/navigation around the central Desktop + WindowLayer region.

## Invariants

- The shell never owns authenticated Neutron application or tray frames. External Elements are opened only through `NeutronBridge.openElement()` and remain Kernel-owned sibling tiles.
- Native task state is derived from `ProcessController` + `WindowManager`; process/window truth is never persisted by the shell.
- Taskbar membership is pinned native handlers + open native process records + pinned Elements + Elements explicitly reported `running: "yes"`. Installed applications are not taskbar entries merely because they are installed.
- Neutron `running` remains `yes | no | unknown`; the shell never converts `unknown` to `no`.
- Pins/theme/wallpaper are browser-local preferences under the namespaced `plasmon.shell.preferences.v1` key. Corrupt/unavailable storage falls back to deterministic defaults.
- Start metadata comes from `NativeAppRegistry` and `NeutronBridge`; there is no second application catalog.
- Filesystem search begins at `FsService.resolvePath("/")`, traverses asynchronously, maintains no persistent index, is bounded to 5,000 nodes per query by default, and uses cancellation + request ordering to prevent stale results from winning.
- File search results dispatch through `AssociationRegistry` + `OpenService`. No extension-to-app switch exists in Shell.
- Tray presentation reads only the frozen `element.tray?.title` declaration and opens/focuses the owning Element through NeutronBridge.
- Shell CSS publishes `--plasmon-*` tokens on the Shell root so integration can place Desktop and native windows inside the same theme boundary.

## Composition

`Shell` is deliberately dependency-injected and leaves its `children` in the central workspace region:

```tsx
<Shell
  process={services.process}
  windows={services.windows}
  fs={services.fs}
  fsEvents={services.fsEvents}
  neutron={services.neutron}
  nativeApps={nativeApps}
  associations={associations}
  openService={openService}
>
  <Desktop ... />
  <WindowLayer ... />
</Shell>
```

Coordinator/integration owns the real composition. Shell does not import integration singletons or construct service implementations.

## Keyboard/accessibility

- Start is a normal taskbar button and also toggles with `Ctrl+Escape`.
- Search opens with its taskbar button or `Ctrl+Space`.
- `Escape` dismisses shell flyouts.
- Start and Search lists support Tab plus Up/Down/Home/End movement.
- Running/focused/unknown state is represented in accessible labels/text, not color alone.
- All icon-only taskbar controls have accessible labels and visible focus styling.
