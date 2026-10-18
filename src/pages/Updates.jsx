import React from 'react';
import { ArrowLeft, History, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReleaseTimeline from '@/components/updates/ReleaseTimeline';
import { APP_VERSION } from '@/config/appVersion';
import { RELEASES } from '@/data/releases';
import { useLanguage } from '@/lib/LanguageContext';

export default function Updates() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  return (
    <div className="sf-page-viewport bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
          <button type="button" onClick={() => navigate('/')} aria-label={t('updates.back')} className="sf-icon-button">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <div><p className="text-sm font-bold">{t('updates.nav')}</p><p className="text-xs text-muted-foreground">SpotFinder v{APP_VERSION}</p></div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 pb-20 sm:px-6 sm:py-12">
        <div className="mb-10 grid gap-6 rounded-3xl border border-primary/15 bg-primary/[0.045] p-6 sm:grid-cols-[1fr_auto] sm:items-end sm:p-9">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background px-3 py-1.5 text-xs font-bold text-primary">
              <History className="h-3.5 w-3.5" aria-hidden="true" /> {t('updates.history')}
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{t('updates.title')}</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">{t('updates.intro')}</p>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-primary"><MapPin className="h-4 w-4" aria-hidden="true" />{t('updates.currentVersion').replace('{version}', APP_VERSION)}</div>
        </div>

        <ReleaseTimeline releases={RELEASES} />

        <p className="mt-8 text-center text-sm text-muted-foreground">{t('updates.earlier')}</p>
      </main>
    </div>
  );
}
