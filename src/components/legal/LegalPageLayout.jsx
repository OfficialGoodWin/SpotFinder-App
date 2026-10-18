import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/lib/LanguageContext';

export default function LegalPageLayout({ title, titleKey, lastUpdated, translatedDraftLanguages = [], children }) {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const translatedTitle = titleKey ? t(titleKey, title) : title;
  const hasTranslatedDraft = translatedDraftLanguages.includes(language.split('-')[0]);
  const displayDate = /^\d{4}-\d{2}-\d{2}$/.test(lastUpdated || '')
    ? new Intl.DateTimeFormat(language, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${lastUpdated}T12:00:00Z`))
    : lastUpdated;
  return (
    <main className="sf-page-viewport bg-background">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/92 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => navigate(-1)}
          aria-label={t('legal.back')}
          className="sf-icon-button flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-foreground" aria-hidden="true" />
        </button>
        <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-foreground sm:text-xl">{translatedTitle}</h1>
      </div>
      <article className="mx-auto max-w-3xl px-5 py-7 pb-20 sm:px-8 sm:py-10">
        {lastUpdated && (
          <p className="text-xs text-gray-400 dark:text-muted-foreground mb-6">{t('legal.lastUpdated', { date: displayDate })}</p>
        )}
        {language !== 'en' && language !== 'en-GB' && (
          <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100" role="note">{t(hasTranslatedDraft ? 'legal.draftNotice' : 'legal.englishNotice')}</p>
        )}
        <div className="sf-surface space-y-4 p-5 sm:p-8">
          {children}
        </div>
      </article>
    </main>
  );
}

// Small manually-styled content helpers (no Tailwind typography plugin is
// installed in this project, so we style headings/paragraphs/lists
// explicitly instead of relying on `prose` classes).
export function LegalH2({ children }) {
  return <h2 className="mb-2 mt-7 text-lg font-bold tracking-tight text-gray-900 dark:text-foreground">{children}</h2>;
}
export function LegalP({ children }) {
  return <p className="text-[15px] leading-7 text-gray-700 dark:text-muted-foreground">{children}</p>;
}
export function LegalUl({ children }) {
  return <ul className="list-disc space-y-2 pl-5 text-[15px] leading-7 text-gray-700 dark:text-muted-foreground">{children}</ul>;
}
export function LegalStrong({ children }) {
  return <strong className="font-semibold text-gray-900 dark:text-foreground">{children}</strong>;
}
export function LegalNote({ children }) {
  return (
    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
      {children}
    </div>
  );
}
