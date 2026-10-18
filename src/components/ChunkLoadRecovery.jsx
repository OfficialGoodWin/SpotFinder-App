import React, { useEffect, useState } from 'react';
import { lazy } from 'react';
import DraftConfirmationDialog from '@/components/ui/DraftConfirmationDialog';
import { hasUnsavedWork, isChunkLoadError, notifyChunkLoadError, takePendingRecoveryIssue } from '@/lib/chunkRecovery';

class ChunkLoadBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error) {
    if (isChunkLoadError(error)) notifyChunkLoadError(error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (!isChunkLoadError(error)) throw error;
    return (
      <div role="alert" className="m-4 rounded-2xl border border-amber-300 bg-background p-4 text-sm text-foreground shadow-lg">
        <p className="font-semibold">This view could not load.</p>
        <button type="button" className="mt-2 min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground"
          onClick={() => notifyChunkLoadError(error)}>Reload options</button>
      </div>
    );
  }
}

export function recoverableLazy(loader) {
  const Component = lazy(loader);
  return function RecoverableLazyComponent(props) {
    return <ChunkLoadBoundary><Component {...props} /></ChunkLoadBoundary>;
  };
}

export default function ChunkLoadRecovery() {
  const [issue, setIssue] = useState(null);
  const [confirmReload, setConfirmReload] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const onChunkError = () => setIssue(takePendingRecoveryIssue() || 'chunk');
    const onUpdate = () => setIssue(current => current || takePendingRecoveryIssue() || 'update');
    const onOnline = () => setOnline(navigator.onLine);
    window.addEventListener('spotfinder:chunk-load-error', onChunkError);
    window.addEventListener('spotfinder:update-available', onUpdate);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOnline);
    setIssue(current => current || takePendingRecoveryIssue());
    return () => {
      window.removeEventListener('spotfinder:chunk-load-error', onChunkError);
      window.removeEventListener('spotfinder:update-available', onUpdate);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOnline);
    };
  }, []);

  const requestReload = () => {
    if (!navigator.onLine) { setOnline(false); return; }
    if (hasUnsavedWork()) setConfirmReload(true);
    else window.location.reload();
  };

  return <>
    <DraftConfirmationDialog
      open={Boolean(issue) && !confirmReload}
      onOpenChange={open => { if (!open) setIssue(null); }}
      title={issue === 'update' ? 'SpotFinder update available' : 'This view could not load'}
      description={online
        ? (issue === 'update' ? 'A newer version is ready. Reload when you have finished your current work.' : 'A newer app version or a network interruption may have prevented this view from loading. Reload when your work is saved.')
        : 'You appear to be offline. Keep this page open, reconnect, then choose Reload app. Your local drafts remain in this browser.'}
      cancelLabel="Later"
      confirmLabel="Reload app"
      onConfirm={requestReload}
    />
    <DraftConfirmationDialog
      open={confirmReload}
      onOpenChange={setConfirmReload}
      title="Reload with unsaved work?"
      description="An open contribution or form may contain unsaved changes. Save your draft or copy your text before reloading. Reloading now may discard those changes."
      cancelLabel="Keep working"
      confirmLabel="Reload anyway"
      destructive
      onConfirm={() => window.location.reload()}
    />
  </>;
}
