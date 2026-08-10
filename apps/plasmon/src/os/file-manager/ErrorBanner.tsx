export interface ErrorBannerProps {
  message: string;
  onDismiss: () => void;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onDismiss, onRetry }: ErrorBannerProps) {
  return (
    <div className="fm-error-banner" role="alert">
      <span>{message}</span>
      <div className="fm-error-banner__actions">
        <button type="button" onClick={onDismiss}>Dismiss</button>
        {onRetry ? <button type="button" onClick={onRetry}>Retry</button> : null}
      </div>
    </div>
  );
}
