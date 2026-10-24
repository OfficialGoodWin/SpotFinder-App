import React, { useEffect, useRef } from 'react';

export default function SignOutDialog({ busy, onCancel, onConfirm }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    cancelRef.current?.focus();
    return () => previousFocus?.isConnected && previousFocus.focus();
  }, []);

  const onKeyDown = event => {
    if (event.key === 'Escape' && !busy) {
      event.preventDefault();
      onCancel();
    }
    if (event.key !== 'Tab') return;
    const buttons = [...dialogRef.current.querySelectorAll('button:not(:disabled)')];
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return <div className="v2-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <section ref={dialogRef} className="v2-confirm v2-signout-confirm" role="alertdialog" aria-modal="true" aria-labelledby="v2-signout-title" aria-describedby="v2-signout-description" onKeyDown={onKeyDown}>
      <h2 id="v2-signout-title">Opravdu se chcete odhlásit?</h2>
      <p id="v2-signout-description">Budete odhlášeni ze svého účtu SpotFinder. Kdykoliv se můžete znovu přihlásit.</p>
      <div><button ref={cancelRef} className="v2-secondary" disabled={busy} onClick={onCancel}>Zůstat přihlášený</button><button className="v2-primary" disabled={busy} onClick={onConfirm}>{busy ? 'Odhlašuji…' : 'Odhlásit se'}</button></div>
    </section>
  </div>;
}
