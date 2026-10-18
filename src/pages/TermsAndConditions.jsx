import React from 'react';
import LegalPageLayout, { LegalH2, LegalP, LegalUl, LegalStrong, LegalNote } from '@/components/legal/LegalPageLayout';
import { useLanguage } from '@/lib/LanguageContext';

export default function TermsAndConditions() {
  const { t } = useLanguage();
  return (
    <LegalPageLayout title="Terms & Conditions" titleKey="legal.termsTitle" lastUpdated="2026-10-17" translatedDraftLanguages={['cs', 'pl']}>
      <LegalNote><LegalStrong>{t('termsDraft.reviewLabel')}</LegalStrong> {t('termsDraft.review')}</LegalNote>
      <LegalP>{t('termsDraft.intro')}</LegalP>

      <LegalH2>{t('termsDraft.serviceTitle')}</LegalH2>
      <LegalP>{t('termsDraft.service')}</LegalP>

      <LegalH2>{t('termsDraft.accountsTitle')}</LegalH2>
      <LegalUl>
        <li>{t('termsDraft.credentials')}</li>
        <li>{t('termsDraft.age')}</li>
        <li>{t('termsDraft.deletion')}</li>
      </LegalUl>

      <LegalH2>{t('termsDraft.contentTitle')}</LegalH2>
      <LegalP>{t('termsDraft.content')}</LegalP>

      <LegalH2>{t('termsDraft.useTitle')}</LegalH2>
      <LegalUl>
        <li>{t('termsDraft.useAccounts')}</li>
        <li>{t('termsDraft.usePrivacy')}</li>
        <li>{t('termsDraft.useScraping')}</li>
      </LegalUl>

      <LegalH2>{t('termsDraft.paymentsTitle')}</LegalH2>
      <LegalUl>
        <li>{t('termsDraft.preview')}</li>
        <li>{t('termsDraft.stripe')}</li>
        <li>{t('termsDraft.cancellation')}</li>
        <li><a href="/RefundPolicy" className="underline text-blue-600 dark:text-blue-400">{t('legal.refundTitle')}</a> — {t('termsDraft.refundReview')}</li>
      </LegalUl>

      <LegalH2>{t('termsDraft.advertisingTitle')}</LegalH2>
      <LegalP>{t('termsDraft.advertising')}</LegalP>
      <LegalH2>{t('termsDraft.liabilityTitle')}</LegalH2>
      <LegalP>{t('termsDraft.liability')}</LegalP>

      <LegalH2>{t('termsDraft.terminationTitle')}</LegalH2>
      <LegalP>{t('termsDraft.termination')}</LegalP>

      <LegalH2>{t('termsDraft.lawTitle')}</LegalH2>
      <LegalP>{t('termsDraft.law')}</LegalP>

      <LegalH2>{t('termsDraft.changesTitle')}</LegalH2>
      <LegalP>{t('termsDraft.changes')}</LegalP>
    </LegalPageLayout>
  );
}
