import React, { useState } from 'react';
import {
  ArrowLeft, Camera, ChevronDown, ExternalLink, Layers, MapPin,
  MessageSquare, Mic, Navigation, Plus, Send, Share2, ShieldCheck,
  Sparkles, Tag,
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

const MapPlacementGraphic = () => (
  <TutorialFrame label="Map with the green Add Spot button selected and a marker being placed">
    <div className="relative h-40 overflow-hidden rounded-xl bg-gradient-to-br from-sky-100 via-emerald-50 to-amber-50 dark:from-sky-950 dark:via-emerald-950 dark:to-slate-900">
      <div className="absolute inset-x-0 top-1/2 h-3 -rotate-6 bg-white/85 dark:bg-slate-700" />
      <div className="absolute left-1/2 top-11 -translate-x-1/2 text-center"><MapPin className="mx-auto h-9 w-9 fill-red-500 text-red-600" /><span className="rounded-full bg-blue-600 px-3 py-1 text-[10px] font-bold text-white">Tap to place spot</span></div>
      <div className="absolute bottom-3 left-1/2 grid h-12 w-12 -translate-x-1/2 place-items-center rounded-full bg-green-600 text-white shadow-lg"><Plus className="h-7 w-7" /></div>
    </div>
  </TutorialFrame>
);

const RequiredFieldsGraphic = () => (
  <TutorialFrame label="Current Add Spot form showing required Spot name and Description fields and optional enrichment">
    <div className="mx-auto max-w-sm space-y-3 rounded-2xl border border-border bg-card p-4">
      <p className="font-bold">Add Spot</p>
      <label className="block text-xs font-semibold">Spot name <span className="text-red-500">*</span><span className="mt-1 block rounded-lg border border-border bg-background px-3 py-2 font-normal text-foreground">Riverside Viewpoint</span></label>
      <label className="block text-xs font-semibold">Description <span className="text-red-500">*</span><span className="mt-1 block rounded-lg border border-border bg-background px-3 py-2 font-normal text-muted-foreground">Quiet viewpoint beside the walking trail.</span></label>
      <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-xs font-semibold"><span>Optional enrichment</span><ChevronDown className="h-4 w-4" /></div>
    </div>
  </TutorialFrame>
);

const EnrichmentGraphic = () => (
  <TutorialFrame label="Optional enrichment with ratings, practical details, photos, and an Instagram or TikTok link">
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-3"><Sparkles className="mb-2 h-5 w-5 text-primary" /><p className="text-xs font-bold">Optional ratings</p><p className="mt-1 text-[11px] text-muted-foreground">Overall · Access · Condition · Safety · Crowdedness</p></div>
      <div className="rounded-xl border border-border bg-card p-3"><Tag className="mb-2 h-5 w-5 text-primary" /><p className="text-xs font-bold">Practical details</p><p className="mt-1 text-[11px] text-muted-foreground">Tags, cost, parking, best time, directions</p></div>
      <div className="rounded-xl border border-dashed border-border bg-card p-3"><Camera className="mb-2 h-5 w-5 text-primary" /><p className="text-xs font-bold">Up to 3 photos</p><p className="mt-1 text-[11px] text-muted-foreground">JPEG, PNG, or WebP · maximum 12 MB each</p></div>
      <div className="rounded-xl border border-border bg-card p-3"><ExternalLink className="mb-2 h-5 w-5 text-primary" /><p className="text-xs font-bold">Social post</p><p className="mt-1 text-[11px] text-muted-foreground">Supported Instagram post/reel or TikTok video</p></div>
    </div>
  </TutorialFrame>
);

const PublishGraphic = () => (
  <TutorialFrame label="Contribution confirmation followed by the Add spot button and successful map confirmation">
    <div className="mx-auto max-w-sm space-y-3">
      <div className="flex gap-2 rounded-xl border border-border bg-card p-3 text-xs"><span className="mt-0.5 grid h-4 w-4 place-items-center rounded border bg-primary text-primary-foreground">✓</span><span>I own or may share the information and photos.</span></div>
      <button type="button" tabIndex={-1} className="w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white">Add spot</button>
      <div className="rounded-xl bg-green-50 px-4 py-3 text-center text-xs font-semibold text-green-800 dark:bg-green-950/50 dark:text-green-200">Spot added to the map.</div>
    </div>
  </TutorialFrame>
);

const RatingsGraphic = () => (
  <TutorialFrame label="Current Spot Details rating form with overall, access, condition, safety, and crowdedness scales">
    <div className="mx-auto max-w-sm rounded-2xl border border-border bg-card p-4">
      <p className="font-bold">Rate this spot</p>
      {['Overall experience', 'Ease of access', 'Condition & cleanliness', 'Safety & comfort', 'Crowdedness'].map((label, index) => (
        <div key={label} className="mt-2 flex items-center justify-between gap-3 text-[11px]"><span>{label}</span><span className={index < 2 ? 'text-amber-500' : 'text-muted-foreground'}>★ ★ ★ ★ ★</span></div>
      ))}
    </div>
  </TutorialFrame>
);

const VoiceGraphic = () => (
  <TutorialFrame label="Description field with the voice dictation microphone button active">
    <div className="mx-auto max-w-sm rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between"><p className="text-xs font-bold">Description *</p><span className="grid h-9 w-9 place-items-center rounded-full bg-red-500 text-white"><Mic className="h-4 w-4" /></span></div>
      <div className="mt-2 rounded-xl border border-primary bg-background p-3 text-sm">A quiet viewpoint with an easy path…</div>
      <p className="mt-2 text-[11px] font-semibold text-red-600">Listening — tap the microphone to stop</p>
    </div>
  </TutorialFrame>
);

const LayersGraphic = () => (
  <TutorialFrame label="Map layer menu with Basic, Outdoor, Aerial, Winter, and Traffic choices">
    <div className="flex h-40 items-center justify-center rounded-xl bg-sky-50 dark:bg-slate-900">
      <div className="w-44 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
        {['Basic', 'Outdoor', 'Aerial', 'Winter', 'Traffic'].map(label => <div key={label} className={`px-4 py-2 text-xs font-semibold ${label === 'Traffic' ? 'bg-primary text-primary-foreground' : 'border-b border-border last:border-0'}`}>{label}</div>)}
      </div>
      <span className="ml-3 grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Layers className="h-5 w-5" /></span>
    </div>
  </TutorialFrame>
);

const NavigateShareGraphic = () => (
  <TutorialFrame label="Spot Details actions for navigation and sharing, followed by drive, bike, and walk route choices">
    <div className="mx-auto max-w-sm space-y-3">
      <div className="rounded-2xl border border-border bg-card p-4"><p className="font-bold">Riverside Viewpoint</p><div className="mt-3 grid grid-cols-2 gap-2"><span className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 p-2 text-xs font-bold text-white"><Navigation className="h-4 w-4" />Navigate</span><span className="flex items-center justify-center gap-2 rounded-xl border border-border p-2 text-xs font-bold"><Share2 className="h-4 w-4" />Share</span></div></div>
      <div className="flex justify-center gap-2 text-xs font-semibold"><span className="rounded-full bg-primary px-3 py-1.5 text-primary-foreground">Drive</span><span className="rounded-full bg-muted px-3 py-1.5">Bike</span><span className="rounded-full bg-muted px-3 py-1.5">Walk</span></div>
    </div>
  </TutorialFrame>
);

const FAQ_SECTIONS = [
  {
    category: 'Getting started',
    items: [
      { q: 'What is SpotFinder?', a: 'SpotFinder is a community map for discovering and sharing useful outdoor places. Browsing, search, map layers, sharing, and route planning work without a registered account. Some contribution and account features have additional identity requirements.' },
      { q: 'Do I need an account?', a: 'You can browse and add a basic spot as a guest through an anonymous app session. A registered, email-verified account is required to rate, like, save, manage synced drafts, or attach supported social content. Owners cannot rate their own spots.' },
      { q: 'Are Elite and Ultra subscriptions available?', a: 'No purchase flow is currently enabled by default. Elite and Ultra cards are previews of possible plans, not an active offer for sale.' },
    ],
  },
  {
    category: 'Adding spots',
    items: [
      { q: 'How do I add a spot?', a: 'Use the green plus button, tap the map to place the marker, then provide the required spot name and description. Open Optional enrichment only if you want to add ratings, practical details, photos, or a supported social link. Confirm your contribution rights and select Add spot.', steps: [
        { label: 'Select the green Add Spot button, then tap the map position.', Graphic: MapPlacementGraphic },
        { label: 'Enter a meaningful spot name and description. Both are required.', Graphic: RequiredFieldsGraphic },
        { label: 'Optionally add ratings, useful details, up to three photos, or a supported social post.', Graphic: EnrichmentGraphic },
        { label: 'Confirm the contribution statement and publish. A success message appears after the server accepts it.', Graphic: PublishGraphic },
      ] },
      { q: 'Which photos and social links can I add?', a: 'You may select up to three supported image files. The app validates and re-encodes accepted images before upload. Only share images you have the right to publish. Social links are optional and limited to recognized Instagram posts/reels or TikTok videos; attaching one requires a verified account.' },
      { q: 'How does voice dictation work?', a: 'Use the microphone beside Description. When the browser supports speech recognition and microphone permission is granted, SpotFinder uses the selected app language and inserts recognized speech into the field. You can stop listening or type instead if recognition is unavailable.', steps: [{ label: 'Tap the microphone beside Description; tap it again to stop.', Graphic: VoiceGraphic }] },
    ],
  },
  {
    category: 'Ratings',
    items: [
      { q: 'How do I rate a spot?', a: 'Sign in with a verified account and open a spot you did not create. The current form includes Overall experience plus optional Ease of access, Condition & cleanliness, Safety & comfort, and Crowdedness scales. Crowdedness describes how busy a place feels; a low value does not mean poor quality.', steps: [{ label: 'Open Spot Details and complete the current rating scales.', Graphic: RatingsGraphic }] },
    ],
  },
  {
    category: 'Map, traffic, and navigation',
    items: [
      { q: 'Which map styles are available?', a: 'Open Map layers to choose Basic, Outdoor, Aerial, Winter, or Traffic. Provider availability and network access can affect individual layers.', steps: [{ label: 'Open Map layers and choose the view that suits the trip.', Graphic: LayersGraphic }] },
      { q: 'What does the Traffic layer show?', a: 'When the TomTom integration is configured and reachable, Traffic displays provider flow tiles and current incident markers such as closures, works, accidents, lane restrictions, and jams. SpotFinder can also display operator-entered closures. This data may be delayed or incomplete and should not replace official road information.' },
      { q: 'How does navigation work?', a: 'Open a spot, select Navigate, and choose SpotFinder navigation or an available external provider. Internal routing supports driving, cycling, and walking profiles with route steps and browser voice guidance when supported. With location updates active, the app requests a new route after detecting that you are more than 80 metres from the route.', steps: [{ label: 'Choose Navigate, select a route profile, then start navigation.', Graphic: NavigateShareGraphic }] },
    ],
  },
  {
    category: 'Sharing and privacy',
    items: [
      { q: 'How do I share a spot?', a: 'Use Share in Spot Details. SpotFinder opens the device share sheet when supported and otherwise copies a direct spot link.', steps: [{ label: 'Use the Navigate and Share actions in Spot Details.', Graphic: NavigateShareGraphic }] },
      { q: 'Does SpotFinder use analytics or advertising?', a: 'Google Analytics and Google AdSense are temporarily disabled in this release. Essential Firebase authentication and reCAPTCHA, maps, routing, search, and user-requested embeds can still contact their providers. See the Privacy and Cookie policies for details.' },
    ],
  },
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

function AboutSection() {
  const features = ['Guest browsing and contributions', 'Verified-account ratings and collections', 'Voice input where the browser supports it', 'MapLibre maps with multiple provider-backed layers', 'Driving, cycling, and walking routes', 'Optional plan previews; checkout disabled by default'];
  return (
    <section className="sf-surface overflow-hidden">
      <div className="border-b border-border bg-primary/[0.055] px-5 py-5 sm:px-6"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><MapPin className="h-5 w-5" /></span><div><h2 className="text-xl font-bold">About SpotFinder</h2><p className="text-sm text-muted-foreground">Community-powered place discovery and routing.</p></div></div></div>
      <ul className="grid gap-2 px-5 py-5 sm:grid-cols-2 sm:px-6">{features.map(feature => <li key={feature} className="flex items-start gap-2.5 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{feature}</li>)}</ul>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/40 px-5 py-4 text-xs text-muted-foreground sm:px-6"><span>React, MapLibre, Firebase, and provider-backed routing</span><a href="/updates" className="inline-flex items-center gap-1.5 font-bold text-primary hover:underline">Version {APP_VERSION} · What’s new <ExternalLink className="h-3.5 w-3.5" /></a></div>
    </section>
  );
}

function FeedbackSection({ language }) {
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
      <div className="flex items-center gap-3 border-b border-border bg-primary/[0.055] px-5 py-4"><MessageSquare className="h-5 w-5 text-primary" /><h2 id="feedback-title" className="text-lg font-bold">Send feedback</h2></div>
      <form onSubmit={handleSubmit} className="space-y-3 p-5">
        {status === 'sent' && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-800 dark:bg-green-950/50 dark:text-green-200">Thank you. Your message was received.</p>}
        {status === 'error' && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-200">Feedback could not be sent. Contact spotfinder@icloud.com.</p>}
        {status === 'required' && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">Please write a message first.</p>}
        <label className="block text-xs font-semibold">Your email (optional)<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" className="sf-control mt-1 w-full text-sm" /></label>
        <label className="block text-xs font-semibold">Your message<textarea value={message} onChange={event => { setMessage(event.target.value); if (status === 'required') setStatus('idle'); }} rows={4} className="sf-control mt-1 w-full resize-none py-3 text-sm" /></label>
        <button type="submit" disabled={status === 'sending'} className="sf-button-primary flex w-full items-center justify-center gap-2"><Send className="h-4 w-4" />{status === 'sending' ? 'Sending…' : 'Send feedback'}</button>
      </form>
    </section>
  );
}

export default function FAQ() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  return (
    <div className="sf-page-viewport bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/92 backdrop-blur-xl"><div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6"><button type="button" onClick={() => navigate('/')} aria-label={t('faq.backToMap')} className="sf-icon-button"><ArrowLeft className="h-4 w-4" /></button><div><h1 className="text-lg font-bold">{t('faq.title')}</h1><p className="text-xs text-muted-foreground">Verified for SpotFinder {APP_VERSION}</p></div></div></header>
      <main className="mx-auto max-w-3xl space-y-7 px-4 py-6 pb-20 sm:px-6 sm:py-8">
        {language !== 'en' && <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">The updated help content is currently verified in English. Reviewed translations are being prepared; the app interface can remain in your selected language.</p>}
        <p className="rounded-2xl border border-primary/15 bg-primary/[0.045] p-4 text-sm leading-6 text-muted-foreground">These instructions describe the current app. Provider-backed features can vary with browser support, configuration, permissions, and network availability.</p>
        {FAQ_SECTIONS.map(section => <section key={section.category} aria-labelledby={`faq-${section.category.replaceAll(' ', '-').toLowerCase()}`}><h2 id={`faq-${section.category.replaceAll(' ', '-').toLowerCase()}`} className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-primary">{section.category}</h2><div className="sf-surface overflow-hidden">{section.items.map(item => <AccordionItem key={item.q} {...item} />)}</div></section>)}
        <AboutSection />
        <FeedbackSection language={language} />
      </main>
    </div>
  );
}
