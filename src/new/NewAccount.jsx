import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, KeyRound, Mail, ShieldCheck, Smartphone, Trash2, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import {
  getFirebaseServices, getMfaRecaptchaVerifier, clearMfaRecaptchaVerifier, startMfaEnrollment,
  completeMfaEnrollment, getEnrolledMfaFactors, unenrollMfaFactor, updateAccountDisplayName,
  resendVerificationEmail, requestAccountDeletion, logout as firebaseLogout,
  getMfaResolverFromError, startMfaSignIn, completeMfaSignIn,
} from '@/api/firebaseClient';
import { currentAccount, linkedProviders, linkPasswordToCurrentAccount, unlinkGoogleAfterPasswordVerification, requestVerifiedEmailChange, reauthenticateAccount, changeAccountPasswordWithMfa } from './accountAuth';
import { PHONE_COUNTRIES, defaultPhoneRegion, normalizeAccountPhone } from './accountPhone';
import './new-account.css';

function AccountMessage({ text, error = false }) {
  return text ? <p className={`sf-new-account-message${error ? ' is-error' : ''}`} role={error ? 'alert' : 'status'}>{text}</p> : null;
}

function AccountField({ label, id, hint, children }) {
  return <div className="sf-new-account-field"><label htmlFor={id}>{label}</label>{children}{hint && <small>{hint}</small>}</div>;
}

function AccountButton({ children, busy, secondary = false, danger = false, ...props }) {
  return <button className={`sf-new-account-button${secondary ? ' is-secondary' : ''}${danger ? ' is-danger' : ''}`} {...props} disabled={busy || props.disabled}>{busy && <span className="sf-new-account-spinner" aria-hidden="true" />}{children}</button>;
}

function AccountRow({ icon: Icon, title, note, onClick, danger = false }) {
  return <button type="button" className={`sf-new-account-row${danger ? ' is-danger' : ''}`} onClick={onClick}><span className="sf-new-account-icon"><Icon size={19} aria-hidden="true" /></span><span><strong>{title}</strong>{note && <small>{note}</small>}</span><ChevronRight size={18} aria-hidden="true" /></button>;
}

function accountError(error, L) {
  const code = error?.code || '';
  if (['auth/credential-already-in-use', 'auth/email-already-in-use', 'auth/account-exists-with-different-credential'].includes(code)) return L('credentialConflict');
  if (code === 'auth/requires-recent-login') return L('recentLogin');
  if (code === 'auth/multi-factor-auth-required') return L('mfaReauth');
  if (code === 'auth/operation-not-allowed' || code === 'auth/unsupported-first-factor') return L('providerUnavailable');
  if (code === 'auth/restricted-browser') return L('browserRequired');
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return L('cancelled');
  if (code === 'auth/popup-blocked') return L('popupBlocked');
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') return L('wrongPassword');
  if (code === 'auth/invalid-email') return L('invalidEmail');
  if (code === 'auth/weak-password' || code === 'auth/invalid-password') return L('weakPassword');
  if (code === 'auth/user-mismatch' || code === 'auth/provider-not-confirmed') return L('identityMismatch');
  if (code === 'auth/missing-password') return L('passwordRequired');
  if (code === 'auth/too-many-requests') return L('tooMany');
  if (code === 'auth/provider-already-linked') return L('alreadyLinked');
  if (code === 'auth/provider-not-linked') return L('methodUnavailable');
  if (code === 'auth/unverified-email') return L('verifyFirst');
  if (code === 'auth/unsupported-second-factor') return L('unsupportedSecondFactor');
  if (code === 'auth/invalid-verification-code' || code === 'auth/code-expired') return L('invalidSmsCode');
  if (code === 'functions/failed-precondition') return /subscription/i.test(error?.message || '') ? L('deleteBlocked') : L('recentLogin');
  if (code === 'functions/internal') return L('deleteFailed');
  return L('operationFailed');
}

export default function NewAccount({ detail = '', onSignIn }) {
  const { user: sessionUser, refreshUser, logout } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const L = key => t(`newAccount.${key}`);
  const firebaseUser = getFirebaseServices()?.auth?.currentUser;
  const available = Boolean(sessionUser && firebaseUser && !firebaseUser.isAnonymous);
  const [, setRevision] = useState(0);
  const providers = available ? linkedProviders(firebaseUser) : new Set();
  const hasPassword = providers.has('password');
  const hasGoogle = providers.has('google.com');
  const [name, setName] = useState(firebaseUser?.displayName || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [reauthMethod, setReauthMethod] = useState('');
  const [confirmGoogleUnlink, setConfirmGoogleUnlink] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState('');
  const [busy, setBusy] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [factors, setFactors] = useState(() => available ? getEnrolledMfaFactors(firebaseUser) : []);
  const [country, setCountry] = useState(() => defaultPhoneRegion(language, navigator.languages || [navigator.language]) || 'OTHER');
  const [customPrefix, setCustomPrefix] = useState('');
  const [phone, setPhone] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [removeFactorUid, setRemoveFactorUid] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [mfaChallenge, setMfaChallenge] = useState(null);
  const [mfaFactorIndex, setMfaFactorIndex] = useState(0);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaError, setMfaError] = useState('');
  const pendingMfa = useRef(null);
  const countryNames = new Intl.DisplayNames([language], { type: 'region' });

  useEffect(() => { setName(firebaseUser?.displayName || ''); }, [firebaseUser?.uid, firebaseUser?.displayName]);
  useEffect(() => { setFactors(available ? getEnrolledMfaFactors(firebaseUser) : []); }, [available, firebaseUser?.uid, sessionUser]);
  useEffect(() => {
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setConfirmGoogleUnlink(false);
    if (pendingMfa.current) {
      pendingMfa.current.reject(Object.assign(new Error('Verification cancelled.'), { code: 'auth/silent-cancelled' }));
      pendingMfa.current = null; clearMfaRecaptchaVerifier(); setMfaChallenge(null);
    }
  }, [detail]);
  useEffect(() => { if (!phoneTouched) setCountry(defaultPhoneRegion(language, navigator.languages || [navigator.language]) || 'OTHER'); }, [language, phoneTouched]);
  useEffect(() => () => { clearMfaRecaptchaVerifier(); pendingMfa.current?.reject(Object.assign(new Error('Verification cancelled.'), { code: 'auth/silent-cancelled' })); pendingMfa.current = null; }, []);
  useEffect(() => { setError(''); setStatus(''); }, [detail]);

  const run = async (kind, action, success, after) => {
    if (busy) return;
    setBusy(kind); setError(''); setStatus('');
    try { const result = await action(); await after?.(result); if (success) setStatus(success); return result; }
    catch (caught) { if (caught?.code !== 'auth/silent-cancelled') setError(accountError(caught, L)); return null; }
    finally { setBusy(''); }
  };
  const refreshProviders = async () => { try { await firebaseUser.reload(); } catch { /* The preceding Firebase change already succeeded; refresh on focus can retry. */ } setRevision(value => value + 1); await refreshUser(); };
  const open = path => navigate(`/new/settings/account/${path}`, { state: { settingsParent: '/new/settings/account' } });
  const availableMethod = hasGoogle && hasPassword ? reauthMethod || 'password' : hasGoogle ? 'google' : 'password';
  const methodSelector = hasGoogle && hasPassword ? <div className="sf-new-account-method-choice" role="group" aria-label={L('verifyWith')}><label><input type="radio" name="account-reauth" checked={availableMethod === 'password'} onChange={() => setReauthMethod('password')} />{L('passwordMethod')}</label><label><input type="radio" name="account-reauth" checked={availableMethod === 'google'} onChange={() => setReauthMethod('google')} />Google</label></div> : null;
  const passwordForReauth = availableMethod === 'password' ? <AccountField id="sf-new-account-current" label={L('currentPassword')}><input id="sf-new-account-current" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required /></AccountField> : null;

  const requestMfaChallenge = (authError, expectedUid) => {
    const resolver = getMfaResolverFromError(authError);
    const phoneHints = (resolver.hints || []).map((factor, index) => ({ factor, index })).filter(({ factor }) => factor.factorId === 'phone');
    if (!phoneHints.length) throw Object.assign(new Error('No SMS factor is available.'), { code: 'auth/unsupported-second-factor' });
    return new Promise((resolve, reject) => {
      pendingMfa.current = { resolve, reject };
      setMfaFactorIndex(0); setMfaCode(''); setMfaError('');
      setMfaChallenge({ resolver, phoneHints, expectedUid, verificationId: '' });
    });
  };
  const cancelMfaChallenge = () => {
    const pending = pendingMfa.current;
    pendingMfa.current = null;
    clearMfaRecaptchaVerifier(); setMfaChallenge(null); setMfaCode(''); setMfaError('');
    pending?.reject(Object.assign(new Error('Verification cancelled.'), { code: 'auth/cancelled-popup-request' }));
  };
  const sendMfaChallenge = async event => {
    event.preventDefault(); setMfaBusy(true); setMfaError('');
    try {
      getFirebaseServices().auth.languageCode = language.split('-')[0];
      const verificationId = await startMfaSignIn(mfaChallenge.resolver, mfaChallenge.phoneHints[mfaFactorIndex].index, getMfaRecaptchaVerifier('sf-new-account-reauth-recaptcha'));
      setMfaChallenge(previous => ({ ...previous, verificationId }));
    } catch (caught) { clearMfaRecaptchaVerifier(); setMfaError(accountError(caught, L)); }
    finally { setMfaBusy(false); }
  };
  const confirmMfaChallenge = async event => {
    event.preventDefault(); setMfaBusy(true); setMfaError('');
    try {
      const verifiedUser = await completeMfaSignIn(mfaChallenge.resolver, mfaChallenge.verificationId, mfaCode.trim());
      if (verifiedUser.uid !== mfaChallenge.expectedUid) throw Object.assign(new Error('Account identity changed during verification.'), { code: 'auth/user-mismatch' });
      const pending = pendingMfa.current;
      pendingMfa.current = null;
      clearMfaRecaptchaVerifier(); setMfaChallenge(null); setMfaCode('');
      pending?.resolve(verifiedUser);
    } catch (caught) { setMfaError(accountError(caught, L)); }
    finally { setMfaBusy(false); }
  };

  if (mfaChallenge) return <div className="sf-new-account-form sf-new-account-reauth"><p>{L('reauthIntro')}</p><div id="sf-new-account-reauth-recaptcha" />{!mfaChallenge.verificationId ? <form onSubmit={sendMfaChallenge}><h2>{L('choosePhone')}</h2>{mfaChallenge.phoneHints.map(({ factor }, index) => <label className="sf-new-account-factor-choice" key={factor.uid || index}><input type="radio" name="account-mfa-factor" autoFocus={index === 0} disabled={mfaBusy} checked={mfaFactorIndex === index} onChange={() => setMfaFactorIndex(index)} /><span>{factor.phoneNumber || factor.displayName || L('phoneNumber')}</span></label>)}<AccountMessage text={mfaError} error /><AccountButton type="submit" busy={mfaBusy}>{L('sendSms')}</AccountButton></form> : <form onSubmit={confirmMfaChallenge}><h2>{L('enterCode')}</h2><p>{t('authMore.codeSentTo', { phone: mfaChallenge.phoneHints[mfaFactorIndex]?.factor.phoneNumber || '' })}</p><AccountField id="sf-new-account-reauth-code" label={L('smsCode')}><input id="sf-new-account-reauth-code" type="text" inputMode="numeric" autoFocus autoComplete="one-time-code" value={mfaCode} onChange={event => setMfaCode(event.target.value)} required /></AccountField><AccountMessage text={mfaError} error /><AccountButton type="submit" busy={mfaBusy} disabled={!mfaCode.trim()}>{L('confirmReauth')}</AccountButton><button className="sf-new-account-text-button" type="button" disabled={mfaBusy} onClick={() => { clearMfaRecaptchaVerifier(); setMfaCode(''); setMfaChallenge(previous => ({ ...previous, verificationId: '' })); }}>{L('requestNewCode')}</button></form>}<button className="sf-new-account-text-button" type="button" disabled={mfaBusy} onClick={cancelMfaChallenge}>{L('cancel')}</button></div>;

  if (!available) return <div className="sf-new-account-empty"><p>{L('signInRequired')}</p><AccountButton type="button" onClick={onSignIn}>{L('signIn')}</AccountButton></div>;

  if (!detail) return <div className="sf-new-account">
    <div className="sf-new-account-profile"><span className="sf-new-account-avatar">{firebaseUser.photoURL ? <img src={firebaseUser.photoURL} alt="" /> : <UserRound size={26} />}</span><div><strong>{firebaseUser.displayName || L('unnamed')}</strong><small>{firebaseUser.email || L('noEmail')}</small><span className="sf-new-account-badges">{hasGoogle && <em>Google</em>}{hasPassword && <em>{L('passwordMethod')}</em>}{firebaseUser.email && <em className={firebaseUser.emailVerified ? 'is-verified' : 'is-unverified'}>{L(firebaseUser.emailVerified ? 'verified' : 'unverified')}</em>}</span></div></div>
    {!firebaseUser.emailVerified && firebaseUser.email && <div className="sf-new-account-verification"><p>{L('verifyNotice')}</p><button type="button" disabled={Boolean(busy)} onClick={() => run('verify', resendVerificationEmail, L('verificationSent'))}>{busy === 'verify' ? L('working') : L('resendVerification')}</button></div>}
    <AccountMessage text={status} /><AccountMessage text={error} error />
    <section className="sf-new-account-group" aria-label={L('profileGroup')}><h2>{L('profileGroup')}</h2><div><AccountRow icon={UserRound} title={L('displayName')} note={firebaseUser.displayName || L('unnamed')} onClick={() => open('name')} /><AccountRow icon={KeyRound} title={L('signInMethods')} note={hasGoogle && hasPassword ? L('methodsSummary') : hasGoogle ? 'Google' : hasPassword ? L('passwordMethod') : L('methodUnavailable')} onClick={() => open('methods')} /><AccountRow icon={Mail} title={L('changeEmail')} note={firebaseUser.email} onClick={() => open('email')} /></div></section>
    <section className="sf-new-account-group" aria-label={L('securityGroup')}><h2>{L('securityGroup')}</h2><div><AccountRow icon={ShieldCheck} title={L('mfa')} note={factors.length ? L('mfaActive') : L('mfaInactive')} onClick={() => open('mfa')} /></div></section>
    <section className="sf-new-account-danger-group" aria-label={L('dangerGroup')}><h2>{L('dangerGroup')}</h2><AccountRow icon={Trash2} title={L('deleteAccount')} note={L('deleteShort')} onClick={() => open('delete')} danger /></section>
    <div className="sf-new-account-signout"><AccountButton type="button" secondary onClick={() => setConfirmSignOut(true)}>{L('signOut')}</AccountButton>{confirmSignOut && <div className="sf-new-account-inline-confirm"><p>{L('signOutConfirm')}</p><div><button type="button" onClick={() => setConfirmSignOut(false)}>{L('cancel')}</button><button type="button" disabled={Boolean(busy)} onClick={() => run('signout', firebaseLogout, '', () => navigate('/new/profile', { replace: true }))}>{busy === 'signout' ? L('working') : L('signOut')}</button></div></div>}</div>
  </div>;

  if (detail === 'name') return <form className="sf-new-account-form" onSubmit={event => { event.preventDefault(); run('name', () => updateAccountDisplayName(name), L('nameSaved'), refreshProviders); }}><p>{L('nameIntro')}</p><AccountField id="sf-new-account-name" label={L('displayName')}><input id="sf-new-account-name" type="text" autoComplete="nickname" minLength={2} maxLength={80} value={name} onChange={event => setName(event.target.value)} required /></AccountField><AccountMessage text={status} /><AccountMessage text={error} error /><AccountButton type="submit" busy={busy === 'name'} disabled={name.trim().length < 2 || name.trim() === firebaseUser.displayName}>{L('saveName')}</AccountButton></form>;

  if (detail === 'methods') return <div className="sf-new-account-form"><p>{L('methodsIntro')}</p><div className="sf-new-account-provider"><span>Google</span><strong>{L(hasGoogle ? 'connected' : 'notConnected')}</strong></div><div className="sf-new-account-provider"><span>{L('passwordMethod')}</span><strong>{L(hasPassword ? 'connected' : 'notConnected')}</strong></div>
    {!hasPassword && <form onSubmit={event => { event.preventDefault(); if (newPassword !== confirmPassword) { setError(L('passwordMismatch')); return; } run('link', () => linkPasswordToCurrentAccount(newPassword, requestMfaChallenge), '', async result => { await refreshProviders(); setStatus(L(result.verified ? 'passwordLinked' : 'passwordLinkedUnverified')); setNewPassword(''); setConfirmPassword(''); }); }}><h2>{L('addPassword')}</h2><p>{L('addPasswordHint')}</p><AccountField id="sf-new-link-password" label={L('newPassword')}><input id="sf-new-link-password" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={event => setNewPassword(event.target.value)} required /></AccountField><AccountField id="sf-new-link-confirm" label={L('confirmPassword')}><input id="sf-new-link-confirm" type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required /></AccountField><AccountButton type="submit" busy={busy === 'link'} disabled={newPassword.length < 8 || !confirmPassword}>{L('addPassword')}</AccountButton></form>}
    {hasPassword && <form onSubmit={event => { event.preventDefault(); run('changePassword', () => changeAccountPasswordWithMfa(currentPassword, newPassword, requestMfaChallenge), L('passwordChanged'), () => { setCurrentPassword(''); setNewPassword(''); }); }}><h2>{L('changePassword')}</h2><AccountField id="sf-new-change-current" label={L('currentPassword')}><input id="sf-new-change-current" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required /></AccountField><AccountField id="sf-new-change-new" label={L('newPassword')}><input id="sf-new-change-new" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={event => setNewPassword(event.target.value)} required /></AccountField><AccountButton type="submit" busy={busy === 'changePassword'} disabled={!currentPassword || newPassword.length < 8}>{L('changePassword')}</AccountButton></form>}
    {hasGoogle && hasPassword && <div className="sf-new-account-unlink"><h2>{L('unlinkGoogle')}</h2><p>{L('unlinkWarning')}</p><label className="sf-new-account-check"><input type="checkbox" checked={confirmGoogleUnlink} onChange={event => setConfirmGoogleUnlink(event.target.checked)} />{L('unlinkConfirm')}</label><AccountField id="sf-new-unlink-password" label={L('currentPassword')}><input id="sf-new-unlink-password" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></AccountField><AccountButton type="button" secondary busy={busy === 'unlink'} disabled={!confirmGoogleUnlink || !currentPassword} onClick={() => run('unlink', () => unlinkGoogleAfterPasswordVerification(currentPassword, requestMfaChallenge), L('googleUnlinked'), async () => { setConfirmGoogleUnlink(false); setCurrentPassword(''); await refreshProviders(); })}>{L('unlinkGoogle')}</AccountButton></div>}
    <AccountMessage text={status} /><AccountMessage text={error} error />
  </div>;

  if (detail === 'email') return <form className="sf-new-account-form" onSubmit={event => { event.preventDefault(); run('email', () => requestVerifiedEmailChange(newEmail, { method: availableMethod, password: currentPassword, language, onMfaRequired: requestMfaChallenge }), L('emailSent'), () => { setNewEmail(''); setCurrentPassword(''); }); }}><p>{L('emailIntro')}</p><div className="sf-new-account-current-email">{L('currentEmail')}: <strong>{firebaseUser.email}</strong></div><AccountField id="sf-new-account-email" label={L('newEmail')}><input id="sf-new-account-email" type="email" autoComplete="email" value={newEmail} onChange={event => setNewEmail(event.target.value)} required /></AccountField>{methodSelector}{passwordForReauth}{hasGoogle && <p className="sf-new-account-note">{L('googleEmailNote')}</p>}<AccountMessage text={status} /><AccountMessage text={error} error /><AccountButton type="submit" busy={busy === 'email'} disabled={!newEmail || availableMethod === 'password' && !currentPassword}>{L('sendEmailLink')}</AccountButton></form>;

  if (detail === 'mfa') {
    const sendCode = async event => {
      event.preventDefault();
      const normalized = normalizeAccountPhone(country, customPrefix, phone);
      if (!normalized) { setError(L('invalidPhone')); return; }
      const sent = await run('sendSms', async () => {
        await reauthenticateAccount(availableMethod, currentPassword, requestMfaChallenge);
        const { auth } = getFirebaseServices();
        auth.languageCode = language.split('-')[0];
        return startMfaEnrollment(currentAccount(), normalized, getMfaRecaptchaVerifier('sf-new-account-recaptcha'));
      }, '', id => { setVerificationId(id); setPhone(normalized); setCurrentPassword(''); });
      if (!sent) clearMfaRecaptchaVerifier();
    };
    const confirmCode = event => { event.preventDefault(); run('confirmSms', () => completeMfaEnrollment(currentAccount(), verificationId, smsCode.trim(), phone), L('mfaEnrolled'), () => { clearMfaRecaptchaVerifier(); setVerificationId(''); setSmsCode(''); setPhone(''); setFactors(getEnrolledMfaFactors(currentAccount())); }); };
    const removeFactor = uid => run('removeMfa', async () => { await reauthenticateAccount(availableMethod, currentPassword, requestMfaChallenge); await unenrollMfaFactor(currentAccount(), uid); }, L('mfaRemoved'), () => { setRemoveFactorUid(''); setCurrentPassword(''); setFactors(getEnrolledMfaFactors(currentAccount())); });
    return <div className="sf-new-account-form"><p>{L('mfaIntro')}</p><div className="sf-new-account-status" role="status">{L(factors.length ? 'mfaActive' : 'mfaInactive')}</div>{factors.map(factor => <div className="sf-new-account-factor" key={factor.uid}><Smartphone size={18} /><span>{factor.phoneNumber || factor.displayName}</span><button type="button" aria-label={t('newAccount.removePhone', { phone: factor.phoneNumber || factor.displayName || L('phoneNumber') })} disabled={Boolean(busy)} onClick={() => setRemoveFactorUid(factor.uid)}>{L('remove')}</button>{removeFactorUid === factor.uid && <div className="sf-new-account-factor-confirm"><p>{L('removeMfaConfirm')}</p>{methodSelector}{passwordForReauth}<button type="button" onClick={() => setRemoveFactorUid('')}>{L('cancel')}</button><AccountButton type="button" danger busy={busy === 'removeMfa'} disabled={availableMethod === 'password' && !currentPassword} onClick={() => removeFactor(factor.uid)}>{L('remove')}</AccountButton></div>}</div>)}<div id="sf-new-account-recaptcha" />
      {removeFactorUid ? null : !verificationId ? <form onSubmit={sendCode}><h2>{L('addPhone')}</h2><AccountField id="sf-new-account-country" label={L('countryCode')}><select id="sf-new-account-country" value={country} onChange={event => { setCountry(event.target.value); setPhoneTouched(true); }}><option value="OTHER">{L('otherCountry')}</option>{PHONE_COUNTRIES.map(([region, dial]) => <option key={region} value={region}>{countryNames.of(region)} ({dial})</option>)}</select></AccountField>{country === 'OTHER' && <AccountField id="sf-new-account-prefix" label={L('countryPrefix')}><input id="sf-new-account-prefix" type="tel" inputMode="tel" placeholder="+" value={customPrefix} onChange={event => setCustomPrefix(event.target.value)} required /></AccountField>}<AccountField id="sf-new-account-phone" label={L('phoneNumber')} hint={L('phoneHint')}><input id="sf-new-account-phone" type="tel" inputMode="tel" autoComplete="tel-national" value={phone} onChange={event => setPhone(event.target.value)} required /></AccountField>{methodSelector}{passwordForReauth}<AccountButton type="submit" busy={busy === 'sendSms'} disabled={!phone.trim() || availableMethod === 'password' && !currentPassword}>{L('sendSms')}</AccountButton></form> : <form onSubmit={confirmCode}><h2>{L('enterCode')}</h2><p>{t('authMore.codeSentTo', { phone })}</p><AccountField id="sf-new-account-code" label={L('smsCode')}><input id="sf-new-account-code" type="text" inputMode="numeric" autoComplete="one-time-code" value={smsCode} onChange={event => setSmsCode(event.target.value)} required /></AccountField><AccountButton type="submit" busy={busy === 'confirmSms'} disabled={!smsCode.trim()}>{L('confirmMfa')}</AccountButton><button className="sf-new-account-text-button" type="button" onClick={() => { clearMfaRecaptchaVerifier(); setVerificationId(''); setSmsCode(''); }}>{L('cancel')}</button></form>}
      <p className="sf-new-account-note">{t('mfaUi.recoveryHint')}</p><AccountMessage text={status} /><AccountMessage text={error} error />
    </div>;
  }

  if (detail === 'delete') return <form className="sf-new-account-form sf-new-account-delete" onSubmit={event => { event.preventDefault(); run('delete', async () => { await reauthenticateAccount(hasPassword ? 'password' : 'google', currentPassword, requestMfaChallenge); await currentAccount().getIdToken(true); return requestAccountDeletion({ confirmation: 'DELETE' }); }, '', async result => { if (result?.status !== 'complete') throw new Error('Deletion was not confirmed.'); await logout(false).catch(() => {}); navigate('/new/profile', { replace: true }); }); }}><div className="sf-new-account-danger-note"><Trash2 size={22} /><strong>{L('deleteAccount')}</strong></div><p>{t('homeUi.deleteDescription')}</p><p className="sf-new-account-note">{t('homeUi.cleanupHint')}</p>{hasPassword && <AccountField id="sf-new-delete-password" label={L('currentPassword')}><input id="sf-new-delete-password" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required /></AccountField>}<AccountField id="sf-new-delete-confirm" label={t('homeUi.typeDeleteLabel')}><input id="sf-new-delete-confirm" type="text" autoComplete="off" value={confirmDelete} onChange={event => setConfirmDelete(event.target.value)} placeholder="DELETE" required /></AccountField><AccountMessage text={error} error /><AccountButton type="submit" danger busy={busy === 'delete'} disabled={confirmDelete !== 'DELETE' || hasPassword && !currentPassword}>{t('homeUi.deleteAccount')}</AccountButton></form>;

  return <p className="sf-new-account-note">{L('unavailable')}</p>;
}
