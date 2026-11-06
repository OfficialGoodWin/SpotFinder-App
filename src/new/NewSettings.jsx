import React, { useLayoutEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Accessibility, BadgeCheck, BookOpen, ChevronLeft, ChevronRight, CircleHelp, Cookie, FileText, Globe2, History, Mail, Map, MessageSquare, Moon, Navigation2, ReceiptText, ShieldCheck, Smartphone, Type, UserRound } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { LANGUAGES, LANGUAGE_VARIANTS } from '@/locales/translations';
import { NAVIGATION_PROVIDERS } from '@/lib/externalNavigation';
import { getTextScale, saveTextScale, TEXT_SCALE_DEFAULT, TEXT_SCALE_MIN, TEXT_SCALE_MAX } from '@/lib/textScale';
import { APP_VERSION } from '@/config/appVersion';
import NewAccount from './NewAccount';
import NewSettingsInfo from './NewSettingsInfo';
import NewSkeleton from './NewSkeleton';
import NewAdminAccess from './NewAdminAccess';
import { isSettingsRoute, settingsBackRoute } from './settingsRoutes';
import './new-settings.css';
export { settingsBackRoute } from './settingsRoutes';

const NAVIGATION_KEY = 'spotfinder_navigation_provider'; // Used by the existing navigation chooser.
const MAP_LAYERS = [['basic', 'Základní', 'Basic'], ['outdoor', 'Turistická', 'Outdoor'], ['aerial', 'Letecká', 'Aerial'], ['winter', 'Zimní', 'Winter'], ['traffic', 'Doprava', 'Traffic']];
const scrollPositions = new globalThis.Map();

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

export default function NewSettings({ onSignIn, mapLayer, onMapLayer, terrain, onTerrain, showZoomButtons, onZoomButtons }) {
  const { user, isLoadingAuth } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const C = (cs, en) => String(language).startsWith('cs') ? cs : en;
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef(null);
  useLayoutEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollPositions.get(location.pathname) || 0; }, [location.pathname]);
  const subsection = location.pathname.split('/')[3] || '';
  const detail = location.pathname.split('/')[4] || '';
  const [textScale, setTextScale] = useState(getTextScale);
  const [navigationProvider, setNavigationProvider] = useState(savedNavigationProvider);
  const go = part => {
    if (typeof part !== 'string' || !part) throw new TypeError('Settings route must be a non-empty string');
    const destination = `/new/settings/${part}`;
    if (destination !== location.pathname) navigate(destination, { state: { settingsParent: location.pathname } });
  };
  const parentRoute = settingsBackRoute(location.pathname, location.state);
  const back = () => {
    if (location.key !== 'default' && location.state?.settingsParent) navigate(-1);
    else if (location.key !== 'default' && !subsection) navigate(-1);
    else if (parentRoute !== location.pathname) navigate(parentRoute, { replace: true });
  };
  const chooseNavigation = id => {
    setNavigationProvider(id);
    try { localStorage.setItem(NAVIGATION_KEY, id); } catch { /* Choice applies for this view only when storage is unavailable. */ }
  };
  const titles = { language: C('Jazyk', 'Language'), navigation: C('Navigační aplikace', 'Navigation app'), appearance: C('Vzhled', 'Appearance'), accessibility: C('Možnosti přístupnosti', 'Accessibility'), account: t('newAccount.management'), mfa: t('newAccount.mfa'), admin: 'Admin' };
  const infoTitles = { faq: C('Časté dotazy', 'Frequently asked questions'), feedback: C('Zpětná vazba', 'Feedback'), report: C('Nahlásit problém', 'Report a problem'), contact: C('Kontaktovat podporu', 'Contact support'), terms: C('Podmínky používání', 'Terms of use'), privacy: C('Ochrana soukromí', 'Privacy'), cookies: 'Cookies', refunds: C('Vrácení peněz', 'Refunds'), preferences: C('Nastavení cookies', 'Cookie preferences'), updates: C('Co je nového', "What's new"), app: C('O aplikaci', 'About') };

  const accountTitles = { name: t('newAccount.displayName'), methods: t('newAccount.signInMethods'), email: t('newAccount.changeEmail'), mfa: t('newAccount.mfa'), delete: t('newAccount.deleteAccount') };
  if (subsection === 'mfa') return <Navigate to="/new/settings/account/mfa" replace />;
  return <section className="sf-new-settings-page" aria-labelledby="sf-new-settings-title">
    <div ref={scrollRef} className="sf-new-settings-scroll" onScroll={event => scrollPositions.set(location.pathname, event.currentTarget.scrollTop)}>
      <div className="sf-new-settings-content">
        <header className="sf-new-settings-header"><button type="button" className="sf-new-settings-back" aria-label={subsection === 'account' && detail ? t('newAccount.backToAccount') : isSettingsRoute(parentRoute) ? t('newAccount.back') : subsection ? t('newAccount.backToSettings') : t('newAccount.backToProfile')} onClick={back}><ChevronLeft size={22} /></button><div className="sf-new-settings-brand"><img src="/app-icon-v2-192.png?v=3" alt="" />SpotFinder</div><span /></header>
        <h1 id="sf-new-settings-title">{(subsection === 'account' && accountTitles[detail]) || infoTitles[detail] || titles[subsection] || C('Nastavení', 'Settings')}<span>.</span></h1>

        {!subsection && (isLoadingAuth ? <NewSkeleton kind="settings" /> : <>
          <div className="sf-new-settings-profile">
            {user?.photoURL ? <img src={user.photoURL} alt="" /> : <span className="sf-new-settings-avatar"><UserRound size={25} /></span>}
            <div><strong>{user?.displayName || (user ? C('Můj účet', 'My account') : C('Procházení jako host', 'Browsing as a guest'))}</strong>{user?.email && <small>{user.email}</small>}{user?.email && <span className={`sf-new-settings-verification${user.emailVerified ? ' is-verified' : ''}`}>{user.emailVerified ? C('Ověřený e-mail', 'Verified email') : C('E-mail čeká na ověření', 'Email awaiting verification')}</span>}</div>
          </div>
          <SettingsGroup title={C('Předvolby', 'Preferences')}>
            <SettingsRow icon={Globe2} label={titles.language} value={[...LANGUAGES, ...LANGUAGE_VARIANTS].find(item => item.code === language)?.nativeName} onClick={() => go('language')} />
            <SettingsRow icon={Navigation2} label={C('Preferovaná navigační aplikace', 'Preferred navigation app')} value={NAVIGATION_PROVIDERS.find(item => item.id === navigationProvider)?.label} onClick={() => go('navigation')} />
            <SettingsRow icon={Moon} label={titles.appearance} value={isDark ? C('Tmavý režim', 'Dark mode') : C('Světlý režim', 'Light mode')} onClick={() => go('appearance')} />
          </SettingsGroup>
          <SettingsGroup title={C('Přístupnost', 'Accessibility')}>
            <SettingsRow icon={Accessibility} label={titles.accessibility} value={C('Ovládání mapy, velikost textu a další', 'Map controls, text size, and more')} onClick={() => go('accessibility')} />
          </SettingsGroup>
          <SettingsGroup title={t('newAccount.accountGroup')}>
            <SettingsRow icon={UserRound} label={t('newAccount.management')} value={t('newAccount.managementSubtitle')} onClick={() => go('account')} />
            {user?.email === 'redm3467@gmail.com' && <SettingsRow icon={ShieldCheck} label="Admin" value="Review and publish submitted spots" onClick={() => go('admin')} />}
          </SettingsGroup>
          <SettingsGroup title={C('Nápověda a podpora', 'Help and support')}>
            <SettingsRow icon={MessageSquare} label={infoTitles.feedback} onClick={() => go('support/feedback')} />
            <SettingsRow icon={BookOpen} label={infoTitles.report} onClick={() => go('support/report')} />
            <SettingsRow icon={CircleHelp} label={infoTitles.faq} onClick={() => go('support/faq')} />
            <SettingsRow icon={Mail} label={infoTitles.contact} onClick={() => go('support/contact')} />
          </SettingsGroup>
          <SettingsGroup title={C('Podmínky používání a právní informace', 'Legal and privacy')}>
            <SettingsRow icon={FileText} label={infoTitles.terms} onClick={() => go('legal/terms')} />
            <SettingsRow icon={BadgeCheck} label={infoTitles.privacy} onClick={() => go('legal/privacy')} />
            <SettingsRow icon={Cookie} label="Cookies" onClick={() => go('legal/cookies')} />
            <SettingsRow icon={Cookie} label={infoTitles.preferences} onClick={() => go('legal/preferences')} />
            <SettingsRow icon={ReceiptText} label={infoTitles.refunds} onClick={() => go('legal/refunds')} />
          </SettingsGroup>
          <SettingsGroup title={C('O aplikaci', 'About')}>
            <SettingsRow icon={History} label={infoTitles.updates} onClick={() => go('about/updates')} />
            <SettingsRow icon={Smartphone} label={C('Verze aplikace', 'App version')} value={APP_VERSION} onClick={() => go('about/app')} />
            <SettingsRow icon={BookOpen} label={infoTitles.app} onClick={() => go('about/app')} />
          </SettingsGroup>
        </>)}

        {subsection === 'language' && <div className="sf-new-settings-panel"><p>{C('Vyber jazyk aplikace.', 'Choose the app language.')}</p><Control label={titles.language}><select aria-label={C('Jazyk aplikace', 'App language')} value={language} onChange={event => setLanguage(event.target.value)}>{[...LANGUAGES, ...LANGUAGE_VARIANTS].map(item => <option key={item.code} value={item.code}>{item.flag} {item.nativeName}</option>)}</select></Control></div>}
        {subsection === 'navigation' && <div className="sf-new-settings-panel"><p>{C('Výběr se použije při otevírání navigace k místu.', 'Your choice is used when opening directions to a place.')}</p>{NAVIGATION_PROVIDERS.map(item => <label className="sf-new-settings-choice" key={item.id}><span>{item.label}</span><input type="radio" name="navigation-provider" value={item.id} checked={navigationProvider === item.id} onChange={() => chooseNavigation(item.id)} /></label>)}</div>}
        {subsection === 'appearance' && <div className="sf-new-settings-panel"><Control label={C('Tmavý režim', 'Dark mode')} detail={C('Přepne vzhled aplikace a mapy.', 'Switches the app and map appearance.')}><input type="checkbox" role="switch" aria-label={C('Tmavý režim', 'Dark mode')} checked={isDark} onChange={toggleTheme} /></Control></div>}
        {subsection === 'accessibility' && <div className="sf-new-settings-panel sf-new-settings-accessibility">
          <h2><Map size={17} /> {C('Ovládání mapy', 'Map controls')}</h2>
          <Control label={C('Zobrazit tlačítka přiblížení', 'Show zoom buttons')} detail={C('Zobrazí na mapě tlačítka + a −.', 'Shows + and − buttons on the map.')}><input type="checkbox" role="switch" aria-label={C('Zobrazit tlačítka přiblížení', 'Show zoom buttons')} checked={showZoomButtons} onChange={event => onZoomButtons(event.target.checked)} /></Control>
          <Control label={C('Vzhled mapy', 'Map style')}><select aria-label={C('Vzhled mapy', 'Map style')} value={mapLayer} onChange={event => onMapLayer(event.target.value)}>{MAP_LAYERS.map(([id, cs, en]) => <option key={id} value={id}>{C(cs, en)}</option>)}</select></Control>
          <Control label={C('3D mapa', '3D map')}><input type="checkbox" role="switch" aria-label={C('3D mapa', '3D map')} checked={terrain} onChange={event => onTerrain(event.target.checked)} /></Control>
          <h2><Type size={17} /> {C('Velikost textu', 'Text size')}</h2>
          <Control label={C('Velikost textu', 'Text size')} detail={`${textScale} %`}><input type="range" min={TEXT_SCALE_MIN} max={TEXT_SCALE_MAX} step="5" value={textScale} onChange={event => setTextScale(saveTextScale(event.target.value))} aria-label={C('Velikost textu', 'Text size')} aria-valuetext={`${textScale} %`} /></Control>
          <div className="sf-new-settings-scale-limits"><span>{TEXT_SCALE_MIN} %</span><span>{TEXT_SCALE_MAX} %</span></div>
          <button type="button" className="sf-new-settings-reset" onClick={() => setTextScale(saveTextScale(TEXT_SCALE_DEFAULT))}>{C('Obnovit výchozí velikost textu', 'Reset text size')}</button>
        </div>}
        {subsection === 'account' && (isLoadingAuth ? <NewSkeleton kind={detail ? 'accountForm' : 'account'} /> : <NewAccount detail={detail} onSignIn={onSignIn} />)}
        {subsection === 'admin' && <NewAdminAccess />}
        {['support', 'legal', 'about'].includes(subsection) && <NewSettingsInfo area={subsection} page={detail} />}
      </div>
    </div>
  </section>;
}
