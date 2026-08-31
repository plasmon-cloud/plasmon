export const DiagnosticSubsystem = {
  Filesystem: "filesystem",
  Process: "process",
  Windowing: "windowing",
  NativeApp: "native-app",
  Shell: "shell",
  Neutron: "neutron",
  Associations: "associations",
  FileManager: "file-manager",
  Runtime: "runtime",
  RuntimeMonaco: "runtime.monaco",
  RuntimeJsDos: "runtime.js-dos",
  RuntimeEmulatorJs: "runtime.emulatorjs",
} as const;

export type DiagnosticSubsystem = typeof DiagnosticSubsystem[keyof typeof DiagnosticSubsystem];

export const DiagnosticRuntime = {
  Monaco: "monaco",
  JsDos: "js-dos",
  EmulatorJs: "emulatorjs",
} as const;

export type DiagnosticRuntime = typeof DiagnosticRuntime[keyof typeof DiagnosticRuntime];

export const DiagnosticOperation = {
  Bootstrap: "bootstrap",
  Read: "read",
  Write: "write",
  Discover: "discover",
  Open: "open",
  Install: "install",
  Load: "load",
  Validate: "validate",
  Start: "start",
  Create: "create",
  Close: "close",
  Save: "save",
  Restore: "restore",
  Stop: "stop",
  Persist: "persist",
  Reconcile: "reconcile",
  Register: "register",
  Queue: "queue",
  Admit: "admit",
  Complete: "complete",
  Move: "move",
  Copy: "copy",
  Delete: "delete",
  Import: "import",
} as const;

export type DiagnosticOperation = typeof DiagnosticOperation[keyof typeof DiagnosticOperation];

export const DiagnosticStage = {
  Invalidation: "invalidation",
  WindowClose: "window-close",
  Discovery: "discovery",
  Parse: "parse",
  ElementLookup: "element-lookup",
  TileSelection: "tile-selection",
  KernelOpenTile: "kernel-open-tile",
  KernelInstallOffer: "kernel-install-offer",
  WindowCreate: "window-create",
  WindowPlacement: "window-placement",
  ProcessCommit: "process-commit",
  PlacementRead: "read",
  PlacementWrite: "write",
  RuntimeLoad: "runtime-load",
  RuntimeStart: "runtime-start",
  ProgressRestore: "progress-restore",
  CloseSave: "close-save",
  CleanupStop: "cleanup-stop",
  RuntimeContainer: "runtime-container",
  HostReady: "host-ready",
  RuntimeMessage: "runtime-message",
  RomValidation: "rom-validation",
  CleanupTerminate: "cleanup-terminate",
  WorkerSource: "worker-source",
  WorkerCreate: "worker-create",
} as const;

export type DiagnosticStage = typeof DiagnosticStage[keyof typeof DiagnosticStage];

export const DiagnosticSource = {
  WindowError: "window.error",
  UnhandledRejection: "unhandledrejection",
  ReactRoot: "react.root",
} as const;

export type DiagnosticSource = typeof DiagnosticSource[keyof typeof DiagnosticSource];

export const DiagnosticCategory = {
  UncaughtException: "uncaught-exception",
  UnhandledRejection: "unhandled-rejection",
} as const;

export type DiagnosticCategory = typeof DiagnosticCategory[keyof typeof DiagnosticCategory];

const event = <T extends string>(value: T): T => value;

export const DiagnosticEvent = {
  Filesystem: {
    BootstrapReady: event("filesystem.bootstrap.ready"),
    BootstrapFailed: event("filesystem.bootstrap.failed"),
    SettingsRestoreFailed: event("diagnostics.settings.restore.failed"),
    NeutronProjectionFailed: event("filesystem.neutron-projection.failed"),
    TrashFailed: event("filesystem.trash.failed"),
    TrashRestoreFailed: event("filesystem.trash.restore.failed"),
    TrashPermanentDeleteFailed: event("filesystem.trash.permanent-delete.failed"),
    TrashEmptyFailed: event("filesystem.trash.empty.failed"),
  },
  Process: {
    StartFailed: event("process.start.failed"),
    CloseHandlerFailed: event("process.close.handler-failed"),
    CloseFailed: event("process.close.failed"),
    WindowLost: event("process.window-lost"),
  },
  Windowing: {
    PlacementRestoreRejected: event("windowing.placement.restore.rejected"),
    PlacementReadFailed: event("windowing.placement.read.failed"),
    PlacementWriteFailed: event("windowing.placement.write.failed"),
  },
  NativeApp: {
    RegistrationFailed: event("native-app.registration.failed"),
    LoadFailed: event("native-app.load.failed"),
    Crashed: event("native-app.crashed"),
  },
  Shell: {
    StartReconcileFailed: event("shell.start.reconcile.failed"),
  },
  Associations: {
    DefaultsReadFailed: event("associations.defaults.read.failed"),
    DefaultsWriteFailed: event("associations.defaults.write.failed"),
  },
  FileManager: {
    DeletePartial: event("file-manager.delete.partial"),
    DeleteFailed: event("file-manager.delete.failed"),
    PasteFailed: event("file-manager.paste.failed"),
    ImportPartial: event("file-manager.import.partial"),
    ImportFailed: event("file-manager.import.failed"),
    MovePartial: event("file-manager.move.partial"),
    MoveFailed: event("file-manager.move.failed"),
  },
  Neutron: {
    DiscoveryFailed: event("neutron.discovery.failed"),
    DiscoveryInvalid: event("neutron.discovery.invalid"),
    OpenInvalid: event("neutron.open.invalid"),
    OpenFailed: event("neutron.open.failed"),
    InstallFailed: event("neutron.install.failed"),
    FrontendCallQueued: event("neutron.frontend-call.queued"),
    FrontendCallAdmitted: event("neutron.frontend-call.admitted"),
    FrontendCallCompleted: event("neutron.frontend-call.completed"),
  },
  Runtime: {
    UncaughtError: event("runtime.uncaught-error"),
    UnhandledRejection: event("runtime.unhandled-rejection"),
  },
  RuntimeMonaco: {
    WorkerFailed: event("runtime.monaco.worker.failed"),
    ConfigInvalid: event("runtime.monaco.config.invalid"),
    ConfigReadFailed: event("runtime.monaco.config.read.failed"),
    ConfigWriteFailed: event("runtime.monaco.config.write.failed"),
  },
  RuntimeJsDos: {
    StartFailed: event("runtime.js-dos.start.failed"),
    RestoreFailed: event("runtime.js-dos.restore.failed"),
    SaveFailed: event("runtime.js-dos.save.failed"),
    StopFailed: event("runtime.js-dos.stop.failed"),
  },
  RuntimeEmulatorJs: {
    ValidationFailed: event("runtime.emulatorjs.validation.failed"),
    StartFailed: event("runtime.emulatorjs.start.failed"),
    ProtocolFailed: event("runtime.emulatorjs.protocol.failed"),
    StopFailed: event("runtime.emulatorjs.stop.failed"),
  },
} as const;

export type DiagnosticEvent = {
  [Subsystem in keyof typeof DiagnosticEvent]: typeof DiagnosticEvent[Subsystem][keyof typeof DiagnosticEvent[Subsystem]]
}[keyof typeof DiagnosticEvent];

type DiagnosticEventGroups = typeof DiagnosticEvent;

export type DiagnosticEventFor<Subsystem extends DiagnosticSubsystem> =
  Subsystem extends "filesystem" ? DiagnosticEventGroups["Filesystem"][keyof DiagnosticEventGroups["Filesystem"]]
  : Subsystem extends "process" ? DiagnosticEventGroups["Process"][keyof DiagnosticEventGroups["Process"]]
  : Subsystem extends "windowing" ? DiagnosticEventGroups["Windowing"][keyof DiagnosticEventGroups["Windowing"]]
  : Subsystem extends "native-app" ? DiagnosticEventGroups["NativeApp"][keyof DiagnosticEventGroups["NativeApp"]]
  : Subsystem extends "shell" ? DiagnosticEventGroups["Shell"][keyof DiagnosticEventGroups["Shell"]]
  : Subsystem extends "associations" ? DiagnosticEventGroups["Associations"][keyof DiagnosticEventGroups["Associations"]]
  : Subsystem extends "file-manager" ? DiagnosticEventGroups["FileManager"][keyof DiagnosticEventGroups["FileManager"]]
  : Subsystem extends "neutron" ? DiagnosticEventGroups["Neutron"][keyof DiagnosticEventGroups["Neutron"]]
  : Subsystem extends "runtime" ? DiagnosticEventGroups["Runtime"][keyof DiagnosticEventGroups["Runtime"]]
  : Subsystem extends "runtime.monaco" ? DiagnosticEventGroups["RuntimeMonaco"][keyof DiagnosticEventGroups["RuntimeMonaco"]]
  : Subsystem extends "runtime.js-dos" ? DiagnosticEventGroups["RuntimeJsDos"][keyof DiagnosticEventGroups["RuntimeJsDos"]]
  : Subsystem extends "runtime.emulatorjs" ? DiagnosticEventGroups["RuntimeEmulatorJs"][keyof DiagnosticEventGroups["RuntimeEmulatorJs"]]
  : DiagnosticEvent;
