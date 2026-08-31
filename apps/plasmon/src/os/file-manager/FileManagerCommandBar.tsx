interface FileManagerCommandBarProps {
  selectionCount: number;
  canCreateShortcut: boolean;
  canPaste: boolean;
  operationRunning: boolean;
  onNewFolder: () => void;
  onNewText: () => void;
  onNewMarkdown: () => void;
  onImport: () => void;
  onCopy: () => void;
  onCut: () => void;
  onCreateShortcut: () => void;
  onSendToDesktop: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}

export function FileManagerCommandBar(props: FileManagerCommandBarProps) {
  const hasSelection = props.selectionCount > 0;
  return (
    <div className="fm-commandbar" role="toolbar" aria-label="File commands">
      <button type="button" onClick={props.onImport} disabled={props.operationRunning}>Import Files…</button>
      <button type="button" onClick={props.onCopy} disabled={!hasSelection}>Copy</button>
      <button type="button" onClick={props.onCut} disabled={!hasSelection}>Cut</button>
      <button type="button" onClick={props.onCreateShortcut} disabled={!props.canCreateShortcut}>Create Shortcut</button>
      <button type="button" onClick={props.onSendToDesktop} disabled={!props.canCreateShortcut}>Send to Desktop</button>
      <button type="button" onClick={props.onPaste} disabled={props.operationRunning || !props.canPaste}>Paste</button>
      <button type="button" onClick={props.onDelete} disabled={!hasSelection}>Delete</button>
      <button type="button" onClick={props.onRefresh}>Refresh</button>
    </div>
  );
}
