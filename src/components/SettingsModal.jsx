import React, { useState } from 'react';
import { X, Moon, Info, Send, HelpCircle, ExternalLink, Globe, ChevronDown } from 'lucide-react';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { LANGUAGES } from '@/locales/translations';

const FAQ_ITEMS = {
  en: [
    { q: 'How do I add a spot?', a: 'Tap the green + button, then tap any location on the map. You can add a description, ratings, and a photo.' },
    { q: 'Do I need an account to add a spot?', a: 'No! You can add spots as a guest. An account lets you manage your own spots later.' },
    { q: 'How do I navigate to a spot?', a: 'Tap a spot marker, then press the Navigate button in the popup.' },
    { q: 'What categories can I rate?', a: 'Parking quality, scenery/beauty, and privacy level — each from 1 to 5 stars.' },
    { q: 'Can anyone rate a spot?', a: 'Yes! Anyone — including guests — can rate both overall and by category.' },
    { q: 'How do I share a spot?', a: 'Open a spot detail, tap the Share button. The link opens the map pinpointed to that spot.' },
    { q: 'How do I switch map style?', a: 'Use the layers button in the bottom-left corner of the map.' },
    { q: 'Can I use voice to describe a spot?', a: 'Yes! Tap the Voice button next to the description field when adding a spot.' },
    { q: 'Is my data private?', a: 'Spots you create are public. Your account info is stored securely via Firebase.' },
    { q: 'What is the traffic/road closure layer?', a: 'Enable it by switching to the Traffic map layer. It shows real-time road closures and traffic jams.' },
  ],
  cs: [
    { q: 'Jak přidám místo?', a: 'Klepněte na zelené tlačítko +, pak klepněte na libovolné místo na mapě.' },
    { q: 'Potřebuji účet pro přidání místa?', a: 'Ne! Místa můžete přidávat jako host. Účet vám umožní spravovat vaše místa.' },
    { q: 'Jak navigovat na místo?', a: 'Klepněte na značku místa, pak stiskněte tlačítko Navigovat.' },
    { q: 'Co mohu hodnotit?', a: 'Kvalitu parkování, krásu a soukromí — každé od 1 do 5 hvězd.' },
    { q: 'Může kdokoli hodnotit místo?', a: 'Ano! Kdokoli, včetně hostů, může hodnotit celkově i podle kategorií.' },
    { q: 'Jak sdílet místo?', a: 'Otevřete detail místa a klepněte na tlačítko Sdílet.' },
  ],
};

export default function SettingsModal({ onClose }) {
  const { isDark, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState('settings');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  const faqItems = FAQ_ITEMS[language] || FAQ_ITEMS.en;

  const handleSendFeedback = async () => {
    if (!feedbackText.trim()) return;
    setFeedbackLoading(true);
    try {
      await fetch('https://formspree.io/f/xyzpqrst', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: JSON.stringify({
          _subject: 'Spotfinder Feedback',
          email: feedbackEmail || 'anonymous@spotfinder.local',
          message: feedbackText
        })
      });
    } catch (_) {}
    setFeedbackSent(true);
    setFeedbackText('');
    setFeedbackEmail('');
    setTimeout(() => setFeedbackSent(false), 3000);
    setFeedbackLoading(false);
  };

  const tabs = [
    { id: 'settings', label: t('nav.settings') },
    { id: 'about',    label: t('settings.about') },
    { id: 'help',     label: t('settings.help') },
    { id: 'feedback', label: t('settings.feedback') },
  ];

  return (
    <div className="fixed inset-0 z-[2000] flex items-end pointer-events-none">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={onClose} />
      <div className="relative w-full bg-background text-foreground rounded-t-3xl shadow-2xl p-6 pointer-events-auto max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">{t('settings.title')}</h2>
          <button onClick={onClose} className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-semibold border-b-2 transition-colors whitespace-nowrap text-sm ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            {/* Dark Mode Toggle */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-2xl">
              <div className="flex items-center gap-3">
                <Moon className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-semibold">{t('settings.darkMode')}</p>
                  <p className="text-sm text-muted-foreground">{isDark ? t('settings.enabled') : t('settings.disabled')}</p>
                </div>
              </div>
              <button
                onClick={toggleTheme}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${isDark ? 'bg-primary' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform ${isDark ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Language Selector */}
            <div className="p-4 bg-muted rounded-2xl">
              <div className="flex items-center gap-3 mb-3">
                <Globe className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-semibold">{t('settings.language')}</p>
                  <p className="text-sm text-muted-foreground">{t('settings.selectLanguage')}</p>
                </div>
              </div>
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.nativeName}</option>
                ))}
              </select>
            </div>

            <p className="text-sm text-muted-foreground text-center mt-6">{t('settings.prefSaved')}</p>
          </div>
        )}

        {/* About Tab */}
        {activeTab === 'about' && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-2xl">
              <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                <Info className="w-5 h-5 text-primary" />
                About SpotFinder
              </h3>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>SpotFinder is your go-to app for discovering and sharing amazing spots on the map. Create, explore, and navigate to interesting locations with ease.</p>
                <p>Anyone can add a spot — no account required. Sign up to manage and track your own contributions.</p>
                <div className="pt-3 border-t border-border space-y-1">
                  <p><strong className="text-foreground">Version:</strong> 2.1.0</p>
                  <p><strong className="text-foreground">Built with:</strong> React, Leaflet, Firebase</p>
                  <p><strong className="text-foreground">Maps:</strong> Mapy.cz · CartoDB · OpenStreetMap</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-muted rounded-2xl text-sm text-muted-foreground space-y-2">
              <p className="font-semibold text-foreground">Privacy</p>
              <p>Spots you create are public. Account info is stored via Firebase Auth. We use Google Analytics for usage insights.</p>
              <p>Ads are served by Google AdSense. No personal data is sold.</p>
            </div>
          </div>
        )}

        {/* Help & FAQ Tab */}
        {activeTab === 'help' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-2">
              {t('faq.title')} — {t('settings.help')}
            </p>
            {faqItems.map((item, i) => (
              <div key={i} className="bg-muted rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-4 py-3.5 text-left text-sm font-semibold flex items-center justify-between gap-2"
                >
                  <span>{item.q}</span>
                  <ChevronDown className={`w-4 h-4 flex-shrink-0 text-muted-foreground transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Feedback Tab */}
        {activeTab === 'feedback' && (
          <div className="space-y-4">
            {feedbackSent && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 rounded-2xl flex items-center gap-2">
                <Send className="w-5 h-5 flex-shrink-0" />
                <p className="font-semibold">Thank you! Feedback sent.</p>
              </div>
            )}
            <div className="space-y-2">
              <label className="block text-sm font-medium">Your Email (optional)</label>
              <input
                type="email"
                value={feedbackEmail}
                onChange={e => setFeedbackEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium">Your Feedback</label>
              <textarea
                value={feedbackText}
                onChange={e => setFeedbackText(e.target.value)}
                placeholder="Tell us what you think..."
                rows={5}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
            <button
              onClick={handleSendFeedback}
              disabled={feedbackLoading || !feedbackText.trim()}
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
            >
              {feedbackLoading
                ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                : <Send className="w-4 h-4" />}
              Send Feedback
            </button>
            <p className="text-xs text-muted-foreground text-center">Your feedback helps us improve SpotFinder</p>
          </div>
        )}
      </div>
    </div>
  );
}
