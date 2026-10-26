import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Accessibility, BadgeCheck, BookOpen, ChevronLeft, ChevronRight, CircleHelp, Cookie, FileText, Globe2, History, KeyRound, LogOut, Mail, Map, MessageSquare, Moon, Navigation2, ReceiptText, ShieldCheck, Smartphone, Type, UserRound } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { LANGUAGES, LANGUAGE_VARIANTS } from '@/locales/translations';
import { NAVIGATION_PROVIDERS } from '@/lib/externalNavigation';
import { getTextScale, saveTextScale, TEXT_SCALE_DEFAULT, TEXT_SCALE_MIN, TEXT_SCALE_MAX } from '@/lib/textScale';
import { APP_VERSION } from '@/config/appVersion';
import AccountSecuritySection from '@/components/AccountSecuritySection';
import MfaSection from '@/components/MfaSection';
import './new-settings.css';

const NAVIGATION_KEY = 'spotfinder_navigation_provider'; // Used by the existing navigation chooser.
const MAP_LAYERS = [['basic', 'Základní'], ['outdoor', 'Turistická'], ['aerial', 'Letecká'], ['winter', 'Zimní'], ['traffic', 'Doprava']];

function savedNavigationProvider() {
  try {
    const id = localStorage.getItem(NAVIGATION_KEY);
    if (NAVIGATION_PROVIDERS.some(provider => provider.id === id)) return id;
  } catch { /* The navigation chooser also tolerates unavailable storage. */ }
  return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'apple' : 'google';
}

function SettingsGroup({ title, children }) {
  return <section className="sf-new-settings-group" aria-label={title}><h2>{title}</h2><div className="sf-new-settings-group-rows">{children}</div></section>;
}

function SettingsRow({ icon: Icon, label, value, onClick, href, danger = false }) {
  const content = <><span className="sf-new-settings-icon"><Icon size={19} strokeWidth={1.8} aria-hidden="true" /></span><span className="sf-new-settings-row-copy"><strong>{label}</strong>{value && <small>{value}</small>}</span><ChevronRight className="sf-new-settings-chevron" size={18} aria-hidden="true" /></>;
  const className = `sf-new-settings-row${danger ? ' is-danger' : ''}`;
  return href ? <a className={className} href={href}>{content}</a> : <button type="button" className={className} onClick={onClick}>{content}</button>;
}

function Control({ label, detail, children }) {
  return <div className="sf-new-settings-control"><div><strong>{label}</strong>{detail && <small>{detail}</small>}</div>{children}</div>;
}

export default function NewSettings({ onSignIn, onSignOut, mapLayer, onMapLayer, terrain, onTerrain }) {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const subsection = location.pathname.split('/')[3] || '';
  const [textScale, setTextScale] = useState(getTextScale);
  const [navigationProvider, setNavigationProvider] = useState(savedNavigationProvider);
  const accountAvailable = Boolean(user);
  const go = part => navigate(`/new/settings/${part}`);
  const back = () => navigate(subsection ? '/new/settings' : '/new/profile');
  const chooseNavigation = id => {
    setNavigationProvider(id);
    try { localStorage.setItem(NAVIGATION_KEY, id); } catch { /* Choice applies for this view only when storage is unavailable. */ }
  };
  const titles = { language: 'Jazyk', navigation: 'Navigační aplikace', appearance: 'Vzhled', accessibility: 'Přístupnost', account: 'Účet a zabezpečení', mfa: 'Dvoufázové ověření' };

  return <section className="sf-new-settings-page" aria-labelledby="sf-new-settings-title">
    <div className="sf-new-settings-scroll">
      <div className="sf-new-settings-content">
        <header className="sf-new-settings-header"><button type="button" className="sf-new-settings-back" aria-label={subsection ? 'Zpět na nastavení' : 'Zpět na profil'} onClick={back}><ChevronLeft size={22} /></button><div className="sf-new-settings-brand"><img src="/mobile-v2/official-logo.png" alt="" />SpotFinder</div><span /></header>
        <h1 id="sf-new-settings-title">{titles[subsection] || 'Nastavení'}<span>.</span></h1>

        {!subsection && <>
          <div className="sf-new-settings-profile">
            {user?.photoURL ? <img src={user.photoURL} alt="" /> : <span className="sf-new-settings-avatar"><UserRound size={25} /></span>}
            <div><strong>{user?.displayName || (user ? 'Můj účet' : 'Procházení jako host')}</strong>{user?.email && <small>{user.email}</small>}{user?.email && <span className={`sf-new-settings-verification${user.emailVerified ? ' is-verified' : ''}`}>{user.emailVerified ? 'Ověřený e-mail' : 'E-mail čeká na ověření'}</span>}</div>
          </div>
          <SettingsGroup title="Předvolby">
            <SettingsRow icon={Globe2} label="Jazyk" value={[...LANGUAGES, ...LANGUAGE_VARIANTS].find(item => item.code === language)?.nativeName} onClick={() => go('language')} />
            <SettingsRow icon={Navigation2} label="Preferovaná navigační aplikace" value={NAVIGATION_PROVIDERS.find(item => item.id === navigationProvider)?.label} onClick={() => go('navigation')} />
            <SettingsRow icon={Moon} label="Vzhled" value={isDark ? 'Tmavý režim' : 'Světlý režim'} onClick={() => go('appearance')} />
          </SettingsGroup>
          <SettingsGroup title="Přístupnost">
            <SettingsRow icon={Map} label="Ovládání mapy" onClick={() => go('accessibility')} />
            <SettingsRow icon={Type} label="Velikost textu" value={`${textScale} %`} onClick={() => go('accessibility')} />
          </SettingsGroup>
          <SettingsGroup title="Účet a zabezpečení">
            {accountAvailable ? <>
              <SettingsRow icon={UserRound} label="Osobní údaje" onClick={() => go('account')} />
              <SettingsRow icon={KeyRound} label="Změna hesla / správa přihlášení" onClick={() => go('account')} />
              <SettingsRow icon={ShieldCheck} label="Dvoufázové ověření" onClick={() => go('mfa')} />
              <SettingsRow icon={LogOut} label="Odhlášení" onClick={onSignOut} danger />
            </> : <SettingsRow icon={UserRound} label="Přihlásit se / vytvořit účet" onClick={onSignIn} />}
          </SettingsGroup>
          <SettingsGroup title="Nápověda a podpora">
            <SettingsRow icon={CircleHelp} label="Časté dotazy" href="/FAQ" />
            <SettingsRow icon={MessageSquare} label="Zpětná vazba" href="/FAQ#feedback-title" />
            <SettingsRow icon={BookOpen} label="Nahlásit problém" href="/FAQ#feedback-title" />
            <SettingsRow icon={Mail} label="Kontaktovat podporu" href="/FAQ#feedback-title" />
          </SettingsGroup>
          <SettingsGroup title="Podmínky používání a právní informace">
            <SettingsRow icon={FileText} label="Podmínky používání" href="/TermsAndConditions" />
            <SettingsRow icon={BadgeCheck} label="Ochrana soukromí" href="/PrivacyPolicy" />
            <SettingsRow icon={Cookie} label="Cookies" href="/CookiePolicy" />
            <SettingsRow icon={ReceiptText} label="Vrácení peněz" href="/RefundPolicy" />
          </SettingsGroup>
          <SettingsGroup title="O aplikaci">
            <SettingsRow icon={History} label="Co je nového" href="/updates" />
            <SettingsRow icon={Smartphone} label="Verze aplikace" value={APP_VERSION} onClick={() => navigate('/new/about')} />
          </SettingsGroup>
        </>}

        {subsection === 'language' && <div className="sf-new-settings-panel"><p>Vyber jazyk aplikace.</p><Control label="Jazyk"><select aria-label="Jazyk aplikace" value={language} onChange={event => setLanguage(event.target.value)}>{[...LANGUAGES, ...LANGUAGE_VARIANTS].map(item => <option key={item.code} value={item.code}>{item.flag} {item.nativeName}</option>)}</select></Control></div>}
        {subsection === 'navigation' && <div className="sf-new-settings-panel"><p>Výběr se použije při otevírání navigace k místu.</p>{NAVIGATION_PROVIDERS.map(item => <label className="sf-new-settings-choice" key={item.id}><span>{item.label}</span><input type="radio" name="navigation-provider" value={item.id} checked={navigationProvider === item.id} onChange={() => chooseNavigation(item.id)} /></label>)}</div>}
        {subsection === 'appearance' && <div className="sf-new-settings-panel"><Control label="Tmavý režim" detail="Přepne vzhled aplikace a mapy."><input type="checkbox" role="switch" aria-label="Tmavý režim" checked={isDark} onChange={toggleTheme} /></Control></div>}
        {subsection === 'accessibility' && <div className="sf-new-settings-panel">
          <Control label="Velikost textu" detail={`${textScale} %`}><input type="range" min={TEXT_SCALE_MIN} max={TEXT_SCALE_MAX} step="5" value={textScale} onChange={event => setTextScale(saveTextScale(event.target.value))} aria-label="Velikost textu" /></Control>
          <button type="button" className="sf-new-settings-reset" onClick={() => setTextScale(saveTextScale(TEXT_SCALE_DEFAULT))}>Obnovit výchozí velikost textu</button>
          <h2><Accessibility size={17} /> Ovládání mapy</h2>
          <Control label="Vzhled mapy"><select aria-label="Vzhled mapy" value={mapLayer} onChange={event => onMapLayer(event.target.value)}>{MAP_LAYERS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Control>
          <Control label="3D mapa"><input type="checkbox" role="switch" aria-label="3D mapa" checked={terrain} onChange={event => onTerrain(event.target.checked)} /></Control>
        </div>}
        {subsection === 'account' && (accountAvailable ? <div className="sf-new-settings-existing"><AccountSecuritySection /></div> : <div className="sf-new-settings-panel"><p>Přihlas se pro správu svého účtu.</p><button className="sf-new-settings-primary" type="button" onClick={onSignIn}>Přihlásit se</button></div>)}
        {subsection === 'mfa' && (accountAvailable ? <div className="sf-new-settings-existing"><MfaSection /></div> : <div className="sf-new-settings-panel"><p>Přihlas se pro správu dvoufázového ověření.</p><button className="sf-new-settings-primary" type="button" onClick={onSignIn}>Přihlásit se</button></div>)}
      </div>
    </div>
  </section>;
}
