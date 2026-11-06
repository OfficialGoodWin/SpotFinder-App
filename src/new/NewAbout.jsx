import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, MapPinned, UsersRound } from 'lucide-react';
import { APP_VERSION } from '@/config/appVersion';
import { useLanguage } from '@/lib/LanguageContext';

export default function NewAbout() {
  const { t } = useLanguage();
  return <div className="sf-new-about">
    <div className="sf-new-about-intro"><img src="/app-icon-v2-192.png?v=3" alt="" /><p>{t('newAbout.intro')}</p></div>
    <section><UsersRound size={20} aria-hidden="true" /><p>{t('newAbout.community')}</p></section>
    <section><MapPinned size={20} aria-hidden="true" /><p>{t('newAbout.mapCredit')} <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">{t('newAbout.mapAttribution')}</a></p></section>
    <div className="sf-new-about-links"><Link to="/new/settings/support/faq"><Compass size={17} aria-hidden="true" />{t('newAbout.support')}</Link><Link to="/new/settings/legal/privacy">{t('newAbout.legal')}</Link></div>
    <small>{t('newAbout.version', { version: APP_VERSION })}</small>
  </div>;
}
