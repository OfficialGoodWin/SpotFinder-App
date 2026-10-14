import React, { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function DraftConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive = false,
  busy = false,
  cancelLabel = 'Continue Editing',
  secondaryLabel,
  onSecondary,
  children,
}) {
  const returnFocusRef = useRef(null);
  useEffect(() => {
    if (open) returnFocusRef.current = document.activeElement;
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={next => { if (!busy) onOpenChange(next); }}>
      <AlertDialogContent
        className="z-[2600] w-[calc(100%-2rem)] max-w-sm gap-0 rounded-[24px] border-white/50 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900 motion-reduce:animate-none"
        onKeyDown={event => event.stopPropagation()}
        onCloseAutoFocus={event => {
          event.preventDefault();
          returnFocusRef.current?.focus?.();
        }}
      >
        <AlertDialogTitle className="text-center text-lg font-bold tracking-tight">{title}</AlertDialogTitle>
        <AlertDialogDescription className="mt-2 text-center text-sm leading-5">{description}</AlertDialogDescription>
        {children}
        {secondaryLabel && (
          <button type="button" disabled={busy} onClick={onSecondary} className="mt-5 min-h-11 w-full rounded-2xl bg-red-50 px-3 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50 dark:bg-red-950/40 dark:text-red-400">
            {secondaryLabel}
          </button>
        )}
        <div className={`${secondaryLabel ? 'mt-2' : 'mt-5'} flex gap-2`}>
          <AlertDialogCancel disabled={busy} className="mt-0 min-h-11 flex-1 rounded-2xl border-0 bg-gray-100 font-semibold text-gray-700 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/15">
            {cancelLabel}
          </AlertDialogCancel>
          <button type="button" disabled={busy} onClick={onConfirm} className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl px-3 text-sm font-semibold text-white disabled:opacity-50 ${destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
            {busy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
