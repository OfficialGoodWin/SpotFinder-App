import React from 'react';
import LegalPageLayout, { LegalH2, LegalP, LegalUl, LegalStrong, LegalNote } from '@/components/legal/LegalPageLayout';
import { useLanguage } from '@/lib/LanguageContext';

const SECTIONS = [
  { key: 'controller', paragraphs: ['controller'] },
  { key: 'data', list: ['auth', 'dob', 'mfa', 'location', 'public', 'private', 'abuse', 'payments', 'tracking'] },
  { key: 'purposes', list: ['purposeCore', 'purposeSafety', 'purposePayments', 'purposeTracking'] },
  { key: 'providers', paragraphs: ['providers'] },
  { key: 'transfers', paragraphs: ['transfers'] },
  { key: 'retention', paragraphs: ['retention', 'retentionPeriods'] },
  { key: 'rights', paragraphs: ['rights'] },
  { key: 'legacy', paragraphs: ['legacy'] },
  { key: 'children', paragraphs: ['children'] },
  { key: 'security', paragraphs: ['security'] },
  { key: 'changes', paragraphs: ['changes'] },
];

export default function PrivacyPolicy() {
  const { t } = useLanguage();
  return (
    <LegalPageLayout title="Privacy Policy" titleKey="legal.privacyTitle" lastUpdated="2026-10-17" translatedDraftLanguages={['cs', 'pl']}>
      <LegalNote><LegalStrong>{t('privacyDraft.reviewLabel')}</LegalStrong> {t('privacyDraft.review')}</LegalNote>
      {SECTIONS.map(section => (
        <React.Fragment key={section.key}>
          <LegalH2>{t(`privacyDraft.${section.key}Title`)}</LegalH2>
          {section.paragraphs?.map(key => <LegalP key={key}>{t(`privacyDraft.${key}`)}</LegalP>)}
          {section.list && <LegalUl>{section.list.map(key => <li key={key}>{t(`privacyDraft.${key}`)}</li>)}</LegalUl>}
        </React.Fragment>
      ))}
    </LegalPageLayout>
  );
}
