import React from 'react';
import LegalPageLayout, { LegalH2, LegalP, LegalUl, LegalStrong, LegalNote } from '@/components/legal/LegalPageLayout';
import { useLanguage } from '@/lib/LanguageContext';

export default function RefundPolicy() {
  const { t } = useLanguage();
  return (
    <LegalPageLayout title="Refund Policy" titleKey="legal.refundTitle" lastUpdated="2026-10-17" translatedDraftLanguages={['cs', 'pl']}>
      <LegalNote><LegalStrong>{t('refundDraft.reviewLabel')}</LegalStrong> {t('refundDraft.review')}</LegalNote>
      <LegalP>{t('refundDraft.intro')}</LegalP>

      <LegalH2>{t('refundDraft.withdrawalTitle')}</LegalH2>
      <LegalP>{t('refundDraft.withdrawal')}</LegalP>

      <LegalH2>{t('refundDraft.cancellationTitle')}</LegalH2>
      <LegalUl>
        <li>{t('refundDraft.cancellationOne')}</li>
        <li>{t('refundDraft.cancellationTwo')}</li>
      </LegalUl>

      <LegalH2>{t('refundDraft.errorsTitle')}</LegalH2>
      <LegalP>{t('refundDraft.errors')}</LegalP>

      <LegalH2>{t('refundDraft.storesTitle')}</LegalH2>
      <LegalP>{t('refundDraft.stores')}</LegalP>
    </LegalPageLayout>
  );
}
