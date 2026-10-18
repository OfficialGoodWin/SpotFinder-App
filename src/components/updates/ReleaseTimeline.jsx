import React from 'react';
import { CheckCircle2, Plus, ShieldCheck, Sparkles, Wrench } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

const CATEGORY_META = {
  added: { icon: Plus, className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200' },
  improved: { icon: Sparkles, className: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200' },
  fixed: { icon: Wrench, className: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200' },
  security: { icon: ShieldCheck, className: 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200' },
};

function ChangeGroup({ category, entries, headingId }) {
  const { t } = useLanguage();
  if (!entries.length) return null;
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className={`mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${meta.className}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />{t(`updates.${category}`)}
      </h3>
      <ul className="space-y-2.5">
        {entries.map(entry => (
          <li key={entry} className="flex gap-2.5 text-sm leading-6 text-muted-foreground">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{entry}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Adapted from the accessible release-list pattern of the MIT-licensed
// "What's New Changelog Timeline" by DHxWhy on 21st.dev. SpotFinder uses a
// semantic ordered list and static cards; no demo animation or external calls.
export default function ReleaseTimeline({ releases }) {
  const { t, language } = useLanguage();
  return (
    <ol className="relative space-y-7 before:absolute before:bottom-6 before:left-[0.7rem] before:top-6 before:w-px before:bg-border sm:before:left-[1.05rem]">
      {releases.map((release, index) => (
        <li key={release.version} className="relative pl-8 sm:pl-12">
          <span className="absolute left-0 top-7 grid h-6 w-6 place-items-center rounded-full border-4 border-background bg-primary shadow-sm sm:h-9 sm:w-9" aria-hidden="true">
            {index === 0 && <span className="h-2 w-2 rounded-full bg-primary-foreground" />}
          </span>
          <article className="sf-surface overflow-hidden">
            <header className="border-b border-border bg-primary/[0.045] px-5 py-5 sm:px-7 sm:py-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">v{release.version}</span>
                {index === 0 && <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{t('updates.currentRelease')}</span>}
                <time dateTime={release.date} className="ml-0 text-xs font-medium text-muted-foreground sm:ml-auto">
                  {new Date(`${release.date}T12:00:00`).toLocaleDateString(language, { year: 'numeric', month: 'long', day: 'numeric' })}
                </time>
              </div>
              <h2 className="mt-4 text-xl font-bold tracking-tight text-foreground sm:text-2xl">{release.title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{release.summary}</p>
            </header>
            <div className="grid gap-6 px-5 py-6 sm:grid-cols-2 sm:px-7">
              {Object.entries(release.changes).map(([category, entries]) => (
                <ChangeGroup
                  key={category}
                  category={category}
                  entries={entries}
                  headingId={`changes-${release.version.replace(/[^a-z0-9]/gi, '-')}-${category}`}
                />
              ))}
            </div>
          </article>
        </li>
      ))}
    </ol>
  );
}

