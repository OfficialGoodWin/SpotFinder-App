import React from 'react';
import LegalPageLayout, { LegalH2, LegalP, LegalUl, LegalStrong, LegalNote } from '@/components/legal/LegalPageLayout';
import { reopenCookieSettings } from '@/components/CookieConsentBanner';
import { useLanguage } from '@/lib/LanguageContext';

export default function CookiePolicy() {
  const { t } = useLanguage();
  return (
    <LegalPageLayout title="Cookie Policy" titleKey="legal.cookiesTitle" lastUpdated="2026-10-17" translatedDraftLanguages={['cs', 'pl']}>
      <LegalNote><LegalStrong>{t('cookieDraft.reviewLabel')}</LegalStrong> {t('cookieDraft.review')}</LegalNote>
      <LegalP>{t('cookieDraft.intro')}</LegalP>
      <button onClick={reopenCookieSettings} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">{t('cookieDraft.manage')}</button>

      <LegalH2>{t('cookieDraft.coreTitle')}</LegalH2>
      <LegalUl>
        <li>{t('cookieDraft.auth')}</li>
        <li>{t('cookieDraft.preferences')}</li>
        <li>{t('cookieDraft.recaptcha')}</li>
        <li>{t('cookieDraft.stripe')}</li>
      </LegalUl>

      <LegalH2>{t('cookieDraft.analyticsTitle')}</LegalH2>
      <LegalP>{t('cookieDraft.analytics')}</LegalP>

      <LegalH2>{t('cookieDraft.adsTitle')}</LegalH2>
      <LegalP>{t('cookieDraft.ads')}</LegalP>

      <LegalH2>{t('cookieDraft.mapsTitle')}</LegalH2>
      <LegalP>{t('cookieDraft.maps')}</LegalP>

      <LegalH2>{t('cookieDraft.consentTitle')}</LegalH2>
      <LegalP>{t('cookieDraft.consent')}</LegalP>
      <LegalP>{t('cookieDraft.futureConsent')}</LegalP>

      <LegalH2>{t('cookieDraft.verificationTitle')}</LegalH2>
      <LegalP>{t('cookieDraft.verification')}</LegalP>
    </LegalPageLayout>
  );
}
