import React, { useState } from 'react';
import {
  ArrowLeft, Camera, ChevronDown, ExternalLink, Layers, MapPin,
  MessageSquare, Mic, Navigation, Plus, Send, Share2, ShieldCheck,
  Tag,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/lib/LanguageContext';
import { submitFeedback } from '@/api/firebaseClient';
import { APP_VERSION } from '@/config/appVersion';

function TutorialFrame({ label, children }) {
  return (
    <figure role="img" aria-label={label} className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/55 px-3 py-2" aria-hidden="true">
        <span className="h-2 w-2 rounded-full bg-red-400" /><span className="h-2 w-2 rounded-full bg-amber-400" /><span className="h-2 w-2 rounded-full bg-green-500" />
        <span className="ml-2 text-[10px] font-semibold text-muted-foreground">SpotFinder example</span>
      </div>
      <div className="min-h-40 p-4" aria-hidden="true">{children}</div>
    </figure>
  );
}

const MapPlacementGraphic = () => {
  const { t } = useLanguage();
  return <TutorialFrame label={t('faqGraphic.mapLabel')}>
    <div className="relative h-40 overflow-hidden rounded-xl bg-gradient-to-br from-sky-100 via-emerald-50 to-amber-50 dark:from-sky-950 dark:via-emerald-950 dark:to-slate-900">
      <div className="absolute inset-x-0 top-1/2 h-3 -rotate-6 bg-white/85 dark:bg-slate-700" />
      <div className="absolute left-1/2 top-11 -translate-x-1/2 text-center"><MapPin className="mx-auto h-9 w-9 fill-red-500 text-red-600" /><span className="rounded-full bg-blue-600 px-3 py-1 text-[10px] font-bold text-white">{t('faqGraphic.tapToPlace')}</span></div>
      <div className="absolute bottom-3 left-1/2 grid h-12 w-12 -translate-x-1/2 place-items-center rounded-full bg-green-600 text-white shadow-lg"><Plus className="h-7 w-7" /></div>
    </div>
  </TutorialFrame>;
};

const RequiredFieldsGraphic = () => {
  const { t } = useLanguage();
  return <TutorialFrame label={t('faqGraphic.requiredLabel')}>
    <div className="mx-auto max-w-sm space-y-3 rounded-2xl border border-border bg-card p-4">
      <p className="font-bold">{t('faqGraphic.addSpot')}</p>
      <label className="block text-xs font-semibold">{t('faqGraphic.spotName')} <span className="text-red-500">*</span><span className="mt-1 block rounded-lg border border-border bg-background px-3 py-2 font-normal text-foreground">{t('faqGraphic.sampleName')}</span></label>
      <label className="block text-xs font-semibold">{t('faqGraphic.description')} <span className="text-red-500">*</span><span className="mt-1 block rounded-lg border border-border bg-background px-3 py-2 font-normal text-muted-foreground">{t('faqGraphic.sampleDescription')}</span></label>
      <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-xs font-semibold"><span>{t('faqGraphic.optional')}</span><ChevronDown className="h-4 w-4" /></div>
    </div>
  </TutorialFrame>;
};

const EnrichmentGraphic = () => {
  const { t } = useLanguage();
  return <TutorialFrame label={t('faqGraphic.enrichmentLabel')}>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-3"><Tag className="mb-2 h-5 w-5 text-primary" /><p className="text-xs font-bold">{t('faqGraphic.practical')}</p><p className="mt-1 text-[11px] text-muted-foreground">{t('faqGraphic.practicalDetails')}</p></div>
      <div className="rounded-xl border border-dashed border-border bg-card p-3"><Camera className="mb-2 h-5 w-5 text-primary" /><p className="text-xs font-bold">{t('faqGraphic.photos')}</p><p className="mt-1 text-[11px] text-muted-foreground">{t('faqGraphic.photoLimits')}</p></div>
      <div className="rounded-xl border border-border bg-card p-3"><ExternalLink className="mb-2 h-5 w-5 text-primary" /><p className="text-xs font-bold">{t('faqGraphic.social')}</p><p className="mt-1 text-[11px] text-muted-foreground">{t('faqGraphic.socialDetails')}</p></div>
    </div>
  </TutorialFrame>;
};

const PublishGraphic = () => {
  const { t } = useLanguage();
  return <TutorialFrame label={t('faqGraphic.publishLabel')}>
    <div className="mx-auto max-w-sm space-y-3">
      <div className="flex gap-2 rounded-xl border border-border bg-card p-3 text-xs"><span className="mt-0.5 grid h-4 w-4 place-items-center rounded border bg-primary text-primary-foreground">✓</span><span>{t('faqGraphic.rights')}</span></div>
      <button type="button" tabIndex={-1} className="w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white">{t('faqGraphic.addSpot')}</button>
      <div className="rounded-xl bg-green-50 px-4 py-3 text-center text-xs font-semibold text-green-800 dark:bg-green-950/50 dark:text-green-200">{t('faqGraphic.added')}</div>
    </div>
  </TutorialFrame>;
};

const RatingsGraphic = () => {
  const { t } = useLanguage();
  return <TutorialFrame label={t('faqGraphic.ratingsLabel')}>
    <div className="mx-auto max-w-sm rounded-2xl border border-border bg-card p-4">
      <p className="font-bold">{t('faqGraphic.rateSpot')}</p>
      {['overall', 'access', 'condition', 'safety', 'crowding'].map((key, index) => (
        <div key={key} className="mt-2 flex items-center justify-between gap-3 text-[11px]"><span>{t(`faqGraphic.${key}`)}</span><span className={index < 2 ? 'text-amber-500' : 'text-muted-foreground'}>★ ★ ★ ★ ★</span></div>
      ))}
    </div>
  </TutorialFrame>;
};

const VoiceGraphic = () => {
  const { t } = useLanguage();
  return <TutorialFrame label={t('faqGraphic.voiceLabel')}>
    <div className="mx-auto max-w-sm rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between"><p className="text-xs font-bold">{t('faqGraphic.description')} *</p><span className="grid h-9 w-9 place-items-center rounded-full bg-red-500 text-white"><Mic className="h-4 w-4" /></span></div>
      <div className="mt-2 rounded-xl border border-primary bg-background p-3 text-sm">{t('faqGraphic.voiceExample')}</div>
      <p className="mt-2 text-[11px] font-semibold text-red-600">{t('faqGraphic.listening')}</p>
    </div>
  </TutorialFrame>;
};

const LayersGraphic = () => {
  const { t } = useLanguage();
  return <TutorialFrame label={t('faqGraphic.layersLabel')}>
    <div className="flex h-40 items-center justify-center rounded-xl bg-sky-50 dark:bg-slate-900">
      <div className="w-44 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
        {['basic', 'outdoor', 'aerial', 'winter', 'traffic'].map(key => <div key={key} className={`px-4 py-2 text-xs font-semibold ${key === 'traffic' ? 'bg-primary text-primary-foreground' : 'border-b border-border last:border-0'}`}>{t(`mapLayers.${key}`)}</div>)}
      </div>
      <span className="ml-3 grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Layers className="h-5 w-5" /></span>
    </div>
  </TutorialFrame>;
};

const NavigateShareGraphic = () => {
  const { t } = useLanguage();
  return <TutorialFrame label={t('faqGraphic.navigateLabel')}>
    <div className="mx-auto max-w-sm space-y-3">
      <div className="rounded-2xl border border-border bg-card p-4"><p className="font-bold">{t('faqGraphic.sampleName')}</p><div className="mt-3 grid grid-cols-2 gap-2"><span className="flex items-center justify-center gap-2 rounded-xl bg-primary p-2 text-xs font-bold text-primary-foreground"><Navigation className="h-4 w-4" />{t('faqGraphic.navigate')}</span><span className="flex items-center justify-center gap-2 rounded-xl border border-border p-2 text-xs font-bold"><Share2 className="h-4 w-4" />{t('faqGraphic.share')}</span></div></div>
      <div className="flex flex-wrap justify-center gap-2 text-xs font-semibold"><span className="rounded-full bg-primary px-3 py-1.5 text-primary-foreground">Google Maps</span><span className="rounded-full bg-muted px-3 py-1.5">Mapy.com</span><span className="rounded-full bg-muted px-3 py-1.5">Apple Maps</span></div>
    </div>
  </TutorialFrame>;
};

const FAQ_SECTIONS = [
  [[], [], []],
  [[MapPlacementGraphic, RequiredFieldsGraphic, EnrichmentGraphic, PublishGraphic], [], [], [VoiceGraphic]],
  [[RatingsGraphic], []],
  [[LayersGraphic], [], [], [NavigateShareGraphic]],
  [[NavigateShareGraphic], [], []],
];

function StepGuide({ steps }) {
  return <ol className="mt-5 space-y-5">{steps.map(({ label, Graphic }, index) => <li key={label} className="grid gap-3 sm:grid-cols-[2rem_1fr]"><span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{index + 1}</span><div><p className="mb-2 text-sm font-semibold">{label}</p><Graphic /></div></li>)}</ol>;
}

function AccordionItem({ q, a, steps }) {
  const [open, setOpen] = useState(false);
  const contentId = React.useId();
  return (
    <div className={`border-b border-border last:border-0 ${open ? 'bg-muted/45' : ''}`}>
      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls={contentId} className="flex min-h-14 w-full items-center justify-between gap-4 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        <span className="text-sm font-semibold">{q}</span><ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && <div id={contentId} className="px-5 pb-5"><p className="text-sm leading-6 text-muted-foreground">{a}</p>{steps && <StepGuide steps={steps} />}</div>}
    </div>
  );
}

function AboutSection({ t }) {
  const features = Array.from({ length: 6 }, (_, index) => t(`faqPage.about.feature${index + 1}`));
  return (
    <section className="sf-surface overflow-hidden">
      <div className="border-b border-border bg-primary/[0.055] px-5 py-5 sm:px-6"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><MapPin className="h-5 w-5" /></span><div><h2 className="text-xl font-bold">{t('faqPage.about.title')}</h2><p className="text-sm text-muted-foreground">{t('faqPage.about.subtitle')}</p></div></div></div>
      <ul className="grid gap-2 px-5 py-5 sm:grid-cols-2 sm:px-6">{features.map(feature => <li key={feature} className="flex items-start gap-2.5 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{feature}</li>)}</ul>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/40 px-5 py-4 text-xs text-muted-foreground sm:px-6"><span>{t('faqPage.about.technology')}</span><a href="/updates" className="inline-flex items-center gap-1.5 font-bold text-primary hover:underline">{t('faqPage.about.whatsNew', { version: APP_VERSION })} <ExternalLink className="h-3.5 w-3.5" /></a></div>
    </section>
  );
}

function FeedbackSection({ language, t }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle');
  const handleSubmit = async event => {
    event.preventDefault();
    if (!message.trim()) { setStatus('required'); return; }
    setStatus('sending');
    try { await submitFeedback({ email: email.trim(), message: message.trim(), language }); setEmail(''); setMessage(''); setStatus('sent'); }
    catch { setStatus('error'); }
  };
  return (
    <section className="sf-surface overflow-hidden" aria-labelledby="feedback-title">
      <div className="flex items-center gap-3 border-b border-border bg-primary/[0.055] px-5 py-4"><MessageSquare className="h-5 w-5 text-primary" /><h2 id="feedback-title" className="text-lg font-bold">{t('faqPage.feedback.title')}</h2></div>
      <form onSubmit={handleSubmit} className="space-y-3 p-5" data-unsaved-work={email.trim() || message.trim() ? 'true' : undefined}>
        {status === 'sent' && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-800 dark:bg-green-950/50 dark:text-green-200">{t('faqPage.feedback.sent')}</p>}
        {status === 'error' && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-200">{t('faqPage.feedback.error')}</p>}
        {status === 'required' && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">{t('faqPage.feedback.required')}</p>}
        <label className="block text-xs font-semibold">{t('faqPage.feedback.email')}<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" className="sf-control mt-1 w-full text-sm" /></label>
        <label className="block text-xs font-semibold">{t('faqPage.feedback.message')}<textarea value={message} onChange={event => { setMessage(event.target.value); if (status === 'required') setStatus('idle'); }} rows={4} className="sf-control mt-1 w-full resize-none py-3 text-sm" /></label>
        <button type="submit" disabled={status === 'sending'} className="sf-button-primary flex w-full items-center justify-center gap-2"><Send className="h-4 w-4" />{t(status === 'sending' ? 'faqPage.feedback.sending' : 'faqPage.feedback.send')}</button>
      </form>
    </section>
  );
}

export default function FAQ() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const sections = FAQ_SECTIONS.map((items, sectionIndex) => ({
    category: t(`faqPage.category${sectionIndex + 1}`),
    items: items.map((graphics, itemIndex) => ({
      q: t(`faqPage.question${sectionIndex + 1}_${itemIndex + 1}`),
      a: t(`faqPage.answer${sectionIndex + 1}_${itemIndex + 1}`),
      steps: graphics.length ? graphics.map((Graphic, stepIndex) => ({ Graphic, label: t(`faqPage.step${sectionIndex + 1}_${itemIndex + 1}_${stepIndex + 1}`) })) : undefined,
    })),
  }));
  return (
    <div className="sf-page-viewport bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/92 backdrop-blur-xl"><div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6"><button type="button" onClick={() => navigate('/')} aria-label={t('faq.backToMap')} className="sf-icon-button"><ArrowLeft className="h-4 w-4" /></button><div><h1 className="text-lg font-bold">{t('faq.title')}</h1><p className="text-xs text-muted-foreground">{t('faqPage.version', { version: APP_VERSION })}</p></div></div></header>
      <main className="mx-auto max-w-3xl space-y-7 px-4 py-6 pb-20 sm:px-6 sm:py-8">
        {!['en', 'cs', 'pl'].includes(language.split('-')[0]) && <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">{t('faqPage.translationNotice')}</p>}
        <p className="rounded-2xl border border-primary/15 bg-primary/[0.045] p-4 text-sm leading-6 text-muted-foreground">{t('faqPage.intro')}</p>
        {sections.map((section, index) => <section key={index} aria-labelledby={`faq-section-${index}`}><h2 id={`faq-section-${index}`} className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-primary">{section.category}</h2><div className="sf-surface overflow-hidden">{section.items.map((item, itemIndex) => <AccordionItem key={itemIndex} {...item} />)}</div></section>)}
        <AboutSection t={t} />
        <FeedbackSection language={language} t={t} />
      </main>
    </div>
  );
}
