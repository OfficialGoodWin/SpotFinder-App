import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { loginWithEmail, registerWithEmail, loginWithGoogle, requestPasswordResetEmail, isRestrictedBrowser, getMfaResolverFromError, getMfaRecaptchaVerifier, clearMfaRecaptchaVerifier, startMfaSignIn, completeMfaSignIn } from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { accountBirthDateBounds, isEligibleBirthDate } from '@/lib/ageEligibility';
import { NewLegalLink } from './legalRoutes';
import './new-auth.css';

const attempts = { count: 0, lockedUntil: 0 };
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function FormError({ children }) {
  return children ? <p className="sf-new-auth-error" role="alert">{children}</p> : null;
}

function AuthButton({ children, kind = 'primary', busy = false, disabled, ...props }) {
  return <button className={`sf-new-auth-button sf-new-auth-button--${kind}`} disabled={busy || disabled} {...props}>
    {busy && <span className="sf-new-auth-spinner" aria-hidden="true" />}{children}
  </button>;
}

function AuthField({ id, label, error, hint, action, password, ...inputProps }) {
  const [visible, setVisible] = useState(false);
  return <div className={`sf-new-auth-field${error ? ' has-error' : ''}`}>
    <div className="sf-new-auth-label-row"><label htmlFor={id}>{label}</label>{action || (hint && <span className="sf-new-auth-hint">{hint}</span>)}</div>
    <div className="sf-new-auth-input-shell">
      <input id={id} aria-invalid={Boolean(error)} aria-describedby={[hint && !action ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined} {...inputProps} type={password ? visible ? 'text' : 'password' : inputProps.type} />
      {password && <button type="button" className="sf-new-auth-reveal" aria-label={visible ? 'Skrýt heslo' : 'Zobrazit heslo'} aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? <EyeOff size={21} /> : <Eye size={21} />}</button>}
    </div>
    {hint && !action && <span id={`${id}-hint`} className="sf-new-auth-field-hint">{hint}</span>}
    {error && <span id={`${id}-error`}><FormError>{error}</FormError></span>}
  </div>;
}

function GoogleIcon() {
  return <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>;
}

export default function NewAuth({ initialScreen = 'login', onClose, onSuccess }) {
  const { t } = useLanguage();
  const { checkUserAuth } = useAuth();
  const [screen, setScreen] = useState(initialScreen);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [mfaResolver, setMfaResolver] = useState(null);
  const [verificationId, setVerificationId] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  const bounds = accountBirthDateBounds();
  const restricted = isRestrictedBrowser();

  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement;
    dialogRef.current?.querySelector('button')?.focus();
    const onKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const elements = [...(dialogRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href]') || [])];
      if (!elements.length) return;
      if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === elements.at(-1)) { event.preventDefault(); elements[0].focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); clearMfaRecaptchaVerifier(); previous?.focus?.(); };
  }, []);
  useEffect(() => {
    if (!lockoutRemaining) return undefined;
    const timer = setInterval(() => setLockoutRemaining(Math.max(0, Math.ceil((attempts.lockedUntil - Date.now()) / 1000))), 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  const changeScreen = next => { setScreen(next); setErrors({}); setResetSent(false); };
  const finish = async () => { await checkUserAuth(); onSuccess?.(); onClose(); };
  const authError = (error, mode) => {
    if (error?.code === 'auth/invalid-email') return t('auth.invalidEmail');
    if (error?.code === 'auth/email-already-in-use') return t('auth.emailInUse');
    if (error?.code === 'auth/weak-password') return t('auth.weakPassword');
    if (error?.code === 'auth/too-many-requests') return t('authErrors.serverLocked');
    if (mode === 'login' && ['auth/wrong-password', 'auth/invalid-credential', 'auth/user-not-found'].includes(error?.code)) return t('auth.invalidCredential');
    return t('auth.somethingWrong');
  };
  const submit = async event => {
    event.preventDefault();
    const next = {};
    if (screen === 'register') {
      if (name.trim().length < 2 || name.trim().length > 80) next.name = 'Zadej jméno nebo přezdívku (2–80 znaků).';
      if (!isEligibleBirthDate(birthDate)) next.birthDate = 'Zadej platné datum narození. Musí ti být alespoň 16 let.';
      if (!agreed) next.agreed = t('auth.mustAgreeToTerms');
    }
    if (!emailPattern.test(email.trim())) next.email = t('auth.invalidEmail');
    if (screen !== 'reset' && !password) next.password = 'Zadej heslo.';
    if (screen === 'register' && password.length < 8) next.password = 'Heslo musí mít alespoň 8 znaků.';
    if (Object.keys(next).length) { setErrors(next); return; }
    if (screen === 'login' && Date.now() < attempts.lockedUntil) { setLockoutRemaining(Math.ceil((attempts.lockedUntil - Date.now()) / 1000)); setErrors({ form: t('authErrors.lockedMinutes', { minutes: 5 }) }); return; }
    setBusy(true); setErrors({});
    try {
      if (screen === 'reset') { await requestPasswordResetEmail(email); setResetSent(true); }
      else {
        if (screen === 'register') await registerWithEmail(email.trim(), password, birthDate, name.trim());
        else await loginWithEmail(email.trim(), password);
        attempts.count = 0; attempts.lockedUntil = 0;
        await finish();
      }
    } catch (error) {
      if (error?.code === 'auth/multi-factor-auth-required') { setMfaResolver(getMfaResolverFromError(error)); return; }
      if (screen === 'login') {
        attempts.count += 1;
        if (attempts.count >= 5) { attempts.lockedUntil = Date.now() + 300000; setLockoutRemaining(300); setErrors({ form: t('authErrors.lockedMinutes', { minutes: 5 }) }); return; }
      }
      setErrors({ form: authError(error, screen) });
    } finally { setBusy(false); }
  };
  const google = async () => {
    if (restricted) return;
    setBusy(true); setErrors({});
    try { const result = await loginWithGoogle(); if (result) await finish(); }
    catch (error) { if (error?.code !== 'auth/popup-closed-by-user') setErrors({ form: t('auth.failedGoogle') }); }
    finally { setBusy(false); }
  };
  const sendMfa = async () => {
    setBusy(true); setErrors({});
    try { setVerificationId(await startMfaSignIn(mfaResolver, 0, getMfaRecaptchaVerifier('sf-new-mfa-recaptcha'))); }
    catch { setErrors({ form: t('auth.somethingWrong') }); }
    finally { setBusy(false); }
  };
  const verifyMfa = async event => {
    event.preventDefault(); setBusy(true); setErrors({});
    try { await completeMfaSignIn(mfaResolver, verificationId, mfaCode.trim()); clearMfaRecaptchaVerifier(); await finish(); }
    catch { setErrors({ form: t('auth.somethingWrong') }); }
    finally { setBusy(false); }
  };

  return <div className="sf-new-auth-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className="sf-new-auth" role="dialog" aria-modal="true" aria-labelledby="sf-new-auth-title">
      <div className="sf-new-auth-body">
        <header className="sf-new-auth-header"><button type="button" className="sf-new-auth-back" aria-label="Zpět" onClick={() => screen === 'reset' ? changeScreen('login') : onClose()}><ChevronLeft size={22} /></button><div className="sf-new-auth-brand"><img src="/app-icon-v2-192.png?v=3" alt="" />SpotFinder</div><span /></header>
        <div className="sf-new-auth-intro"><h1 id="sf-new-auth-title">{mfaResolver ? 'Ověř svůj účet' : screen === 'reset' ? 'Obnovit heslo' : screen === 'register' ? 'Vytvořit účet' : 'Vítej zpět'}<span>.</span></h1><p>{mfaResolver ? 'Dokonči přihlášení bezpečnostním kódem.' : screen === 'reset' ? 'Pošleme ti odkaz pro nastavení nového hesla.' : screen === 'register' ? 'Přidej se a objevuj místa, která stojí za cestu.' : 'Přihlas se a pokračuj tam, kde jsi skončil.'}</p></div>
        {mfaResolver ? <form className="sf-new-auth-form" onSubmit={verifyMfa}><p className="sf-new-auth-note">{mfaResolver.hints[0]?.phoneNumber ? t('authMore.codeSentTo', { phone: mfaResolver.hints[0].phoneNumber }) : t('authMore.codeRequired')}</p><div id="sf-new-mfa-recaptcha" />{verificationId ? <><AuthField id="sf-new-mfa-code" label="Ověřovací kód" value={mfaCode} onChange={event => setMfaCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" required /><AuthButton type="submit" busy={busy} disabled={!mfaCode.trim()}>{t('authMore.verifySignIn')}</AuthButton></> : <AuthButton type="button" busy={busy} onClick={sendMfa}>{t('authMore.sendCode')}</AuthButton>}<FormError>{errors.form}</FormError><button type="button" className="sf-new-auth-guest" onClick={() => { clearMfaRecaptchaVerifier(); setMfaResolver(null); setVerificationId(''); }}>Zpět na přihlášení</button></form> : <>
          {screen === 'register' && <nav className="sf-new-auth-segments" aria-label="Přihlášení nebo registrace"><button type="button" onClick={() => changeScreen('login')}>Přihlášení</button><span aria-current="page">Registrace</span></nav>}
          {screen !== 'reset' && <><AuthButton type="button" kind="google" onClick={google} disabled={busy || restricted}><GoogleIcon />{screen === 'register' ? 'Pokračovat přes Google' : 'Pokračovat s účtem Google'}</AuthButton>{restricted && <p className="sf-new-auth-note">{t('auth.inAppBrowserBody')} <a href={window.location.href} target="_blank" rel="noopener noreferrer">{t('auth.openInBrowser')}</a></p>}<div className="sf-new-auth-divider"><span /><em>nebo e-mailem</em><span /></div></>}
          <form className="sf-new-auth-form" onSubmit={submit} noValidate>
            {screen === 'register' && <><AuthField id="sf-new-name" label="Zobrazované jméno" value={name} onChange={event => { setName(event.target.value); setErrors(value => ({ ...value, name: '' })); }} autoComplete="nickname" placeholder="Tvé jméno nebo přezdívka" error={errors.name} /><div className="sf-new-auth-field"><div className="sf-new-auth-label-row"><label htmlFor="sf-new-dob">Datum narození</label></div><div className={`sf-new-auth-input-shell${errors.birthDate ? ' has-error' : ''}`}><input id="sf-new-dob" type="date" autoComplete="bday" min={bounds.min} max={bounds.max} value={birthDate} onChange={event => { setBirthDate(event.target.value); setErrors(value => ({ ...value, birthDate: '' })); }} aria-invalid={Boolean(errors.birthDate)} aria-describedby="sf-new-dob-note sf-new-dob-error" /></div>{errors.birthDate && <span id="sf-new-dob-error"><FormError>{errors.birthDate}</FormError></span>}<p className="sf-new-auth-date-note" id="sf-new-dob-note"><LockKeyhole size={13} />Musí ti být alespoň 16 let. Datum narození zůstává soukromé.</p></div></>}
            <AuthField id="sf-new-email" label="E-mail" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="jan.novak@email.cz" value={email} onChange={event => { setEmail(event.target.value); setErrors(value => ({ ...value, email: '' })); }} error={errors.email} />
            {screen !== 'reset' && <AuthField id="sf-new-password" label="Heslo" password autoComplete={screen === 'register' ? 'new-password' : 'current-password'} placeholder={screen === 'register' ? 'Vytvoř si heslo' : 'Zadej své heslo'} value={password} onChange={event => { setPassword(event.target.value); setErrors(value => ({ ...value, password: '' })); }} error={errors.password} action={screen === 'login' ? <button type="button" className="sf-new-auth-forgot" onClick={() => changeScreen('reset')}>Zapomněl jsi heslo?</button> : <span className="sf-new-auth-hint">min. 8 znaků</span>} />}
            {screen === 'register' && <div className="sf-new-auth-terms"><label className="sf-new-auth-check"><input type="checkbox" aria-label="Souhlasím s podmínkami používání a zásadami ochrany osobních údajů" checked={agreed} onChange={event => { setAgreed(event.target.checked); setErrors(value => ({ ...value, agreed: '' })); }} aria-describedby={errors.agreed ? 'sf-new-agreement-error' : undefined} /><span aria-hidden="true">✓</span></label><p>Souhlasím s <NewLegalLink document="/TermsAndConditions" target="_blank" rel="noopener noreferrer">Podmínkami používání</NewLegalLink> a <NewLegalLink document="/PrivacyPolicy" target="_blank" rel="noopener noreferrer">Zásadami ochrany osobních údajů</NewLegalLink>.</p>{errors.agreed && <div id="sf-new-agreement-error" className="sf-new-auth-terms-error"><FormError>{errors.agreed}</FormError></div>}</div>}
            <FormError>{errors.form}</FormError>{lockoutRemaining > 0 && <p className="sf-new-auth-note" role="status">{t('authMore.lockedSeconds', { seconds: lockoutRemaining })}</p>}{resetSent && <p className="sf-new-auth-note" role="status">Pokud k této adrese existuje účet, dorazí e-mail s odkazem.</p>}
            <div className="sf-new-auth-actions"><AuthButton type="submit" busy={busy} disabled={lockoutRemaining > 0 && screen === 'login'}>{busy ? screen === 'reset' ? 'Odesílám…' : 'Pokračuji…' : screen === 'reset' ? 'Odeslat odkaz' : screen === 'register' ? 'Vytvořit účet' : 'Přihlásit se'}</AuthButton>{screen === 'login' && <AuthButton type="button" kind="secondary" onClick={() => changeScreen('register')}>Vytvořit účet</AuthButton>}{screen === 'reset' && <AuthButton type="button" kind="secondary" onClick={() => changeScreen('login')}>Zpět na přihlášení</AuthButton>}</div>
          </form>
          <button type="button" className="sf-new-auth-guest" onClick={onClose}>Pokračovat jako host</button>
          {screen === 'login' && <p className="sf-new-auth-legal">Pokračováním souhlasíš s <NewLegalLink document="/TermsAndConditions" target="_blank" rel="noopener noreferrer">Podmínkami používání</NewLegalLink> a <NewLegalLink document="/PrivacyPolicy" target="_blank" rel="noopener noreferrer">Zásadami ochrany osobních údajů</NewLegalLink>.</p>}
        </>}
      </div>
    </section>
  </div>;
}
