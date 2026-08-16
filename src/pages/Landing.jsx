import React, { useEffect } from 'react';
import { ArrowRight, Star, MapPin, Navigation, Mic, Layers, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/lib/LanguageContext';

const LANDING_SEEN_KEY = 'spotfinder_seen_hero';

const LANDING_CONTENT = {
  en: {
    heroTitle: 'Find Your Next Spot',
    heroSubtitle: 'SpotFinder helps you discover parking, viewpoints, and rest areas with community ratings, live traffic, and offline maps.',
    ctaPrimary: 'Open Map',
    ctaSecondary: 'How It Works',
    features: [
      { icon: Star, title: 'Community Ratings', desc: 'See real ratings for parking, beauty, and privacy before you go.' },
      { icon: MapPin, title: 'Smart Spots', desc: 'Discover hidden places added by drivers and explorers.' },
      { icon: Navigation, title: 'Turn-by-Turn', desc: 'Drive, bike, or walk with voice-guided navigation.' },
      { icon: Layers, title: 'Live Layers', desc: 'Switch map styles and view live traffic and closures.' },
      { icon: Mic, title: 'Voice Input', desc: 'Add spot descriptions quickly with voice dictation.' },
      { icon: Sparkles, title: 'Offline Ready', desc: 'Download maps and keep moving without internet.' },
    ],
    stats: [
      { value: '13', label: 'Languages' },
      { value: '24/7', label: 'Always Available' },
    ],
    footer: 'Built by the community for everyday travel.',
  },
  cs: {
    heroTitle: 'Najděte svůj další spot',
    heroSubtitle: 'SpotFinder vám pomůže najít parkování, vyhlídky a odpočívadla díky komunitním hodnocením, živé dopravě a offline mapám.',
    ctaPrimary: 'Otevřít mapu',
    ctaSecondary: 'Jak to funguje',
    features: [
      { icon: Star, title: 'Komunitní hodnocení', desc: 'Před cestou uvidíte skutečné hodnocení parkování, krásy a soukromí.' },
      { icon: MapPin, title: 'Chytré spoty', desc: 'Objevujte skrytá místa přidaná řidiči a cestovateli.' },
      { icon: Navigation, title: 'Navigace krok za krokem', desc: 'Auto, kolo nebo pěšky s hlasovou navigací.' },
      { icon: Layers, title: 'Živé vrstvy', desc: 'Přepínejte styly map a sledujte dopravu i uzavírky.' },
      { icon: Mic, title: 'Hlasový vstup', desc: 'Přidávejte popisy spotů rychle pomocí diktování.' },
      { icon: Sparkles, title: 'Offline připraveno', desc: 'Stáhněte mapy a pokračujte i bez internetu.' },
    ],
    stats: [
      { value: '13', label: 'Jazyků' },
      { value: '24/7', label: 'Vždy dostupné' },
    ],
    footer: 'Vytvořeno komunitou pro každodenní cestování.',
  },
};

export default function Landing() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const content = LANDING_CONTENT[language] || LANDING_CONTENT.en;

  useEffect(() => {
    try {
      localStorage.setItem(LANDING_SEEN_KEY, '1');
    } catch (_) {}
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-gray-900 dark:text-gray-100">
      <section className="relative overflow-hidden">
        <div className="absolute -top-24 -left-20 w-72 h-72 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="absolute top-20 -right-16 w-72 h-72 rounded-full bg-green-400/20 blur-3xl" />

        <div className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center relative z-10">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-sm font-semibold mb-6">
            <img src="/favicon.svg" alt="SpotFinder logo" className="w-4 h-4" />
            SpotFinder
          </span>

          <h1 className="text-5xl md:text-7xl font-black leading-tight mb-6 bg-gradient-to-r from-blue-700 via-cyan-600 to-green-600 bg-clip-text text-transparent">
            {content.heroTitle}
          </h1>

          <p className="max-w-3xl mx-auto text-lg md:text-2xl text-gray-600 dark:text-gray-300 mb-10 leading-relaxed">
            {content.heroSubtitle}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-14">
            <button
              onClick={() => navigate('/Home')}
              type="button"
              className="px-10 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-green-500 text-white font-bold text-lg shadow-lg hover:from-blue-700 hover:to-green-600 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {content.ctaPrimary}
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/faq')}
              type="button"
              className="px-10 py-4 rounded-2xl border-2 border-blue-200 text-blue-700 dark:text-blue-300 dark:border-blue-800 bg-white/70 dark:bg-slate-900/40 font-semibold text-lg hover:bg-blue-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              {content.ctaSecondary}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
            {content.stats.map((s) => (
              <div key={s.label} className="rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-blue-100 dark:border-slate-800 px-4 py-5 shadow-sm">
                <div className="text-2xl md:text-3xl font-extrabold text-blue-700 dark:text-blue-300">{s.value}</div>
                <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {content.features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div key={i} className="rounded-2xl border border-blue-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 p-6 hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-600 to-green-500 flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">{feature.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-blue-100 dark:border-slate-800 py-10 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{content.footer}</p>
        <div className="flex items-center justify-center gap-5 text-sm">
          <a href="/privacy" className="text-blue-600 hover:text-blue-700 dark:text-blue-300">Privacy</a>
          <a href="/terms" className="text-blue-600 hover:text-blue-700 dark:text-blue-300">Terms</a>
          <a href="/faq" className="text-blue-600 hover:text-blue-700 dark:text-blue-300">FAQ</a>
        </div>
      </footer>
    </div>
  );
}
