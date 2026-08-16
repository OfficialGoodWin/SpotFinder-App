import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/lib/LanguageContext';

const PRIVACY_CONTENT = {
  en: {
    title: 'Privacy Policy',
    back: 'Back to Map',
    lastUpdated: 'Last updated: December 2024',
    intro: `SpotFinder respects your privacy. We collect minimal data to provide the service. This policy explains what we collect and how we use it.`,
    sections: [
      {
        title: 'What We Collect',
        content: `• **Location**: Only when using map/navigation features (never stored)\n• **Spots**: Public data you create (title, description, ratings, photos)\n• **Feedback**: Optional email + message (stored in Firebase)\n• **Analytics**: No third-party tracking`
      },
      {
        title: 'Guest Mode',
        content: `No account? No problem. All features work as guest. Spot data is public/community-owned. No personal data collected.`
      },
      {
        title: 'Account Data',
        content: `Email/Google accounts: Used only for spot ownership + notifications. Never sold/shared.`
      },
      {
        title: 'Photos',
        content: `User-uploaded photos stored publicly in Firebase Storage. Used only for spot display.`
      },
      {
        title: 'Data Retention',
        content: `Spots: Permanent (community resource)\nFeedback: 2 years\nPhotos: With spot`
      },
      {
        title: 'Your Rights',
        content: `• Delete your spots anytime\n• Request data export (contact support)\n• GDPR compliant (EU)`
      },
      {
        title: 'Contact',
        content: `Questions? Email: support@spotfinder.app`
      }
    ]
  },
  // Add translations as needed...
  cs: {
    title: 'Ochrana soukromí',
    back: 'Zpět na mapu',
    lastUpdated: 'Naposledy aktualizováno: Prosinec 2024',
    intro: `SpotFinder respektuje vaše soukromí. Shromažďujeme minimální data pro fungování služby. Tato politika vysvětluje, co sbíráme a jak to používáme.`,
    // ... sections
  }
};

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const content = PRIVACY_CONTENT[language] || PRIVACY_CONTENT.en;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-['Roboto',sans-serif] pt-6 px-4">
      {/* Header */}
      <div className="max-w-2xl mx-auto mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          {content.back}
        </button>
        <h1 className="font-['Montserrat',sans-serif] text-4xl md:text-5xl font-black mb-4 text-gray-900 dark:text-white">
          {content.title}
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300">{content.lastUpdated}</p>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto space-y-12">
        <div className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm rounded-3xl p-8 border border-gray-200 dark:border-gray-800">
          <p className="text-lg leading-relaxed mb-8 text-gray-700 dark:text-gray-300">{content.intro}</p>
        </div>

        {content.sections.map((section, i) => (
          <div key={i} className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm rounded-3xl p-8 border border-gray-200 dark:border-gray-800">
            <h2 className="font-['Montserrat',sans-serif] text-2xl font-bold mb-6 text-gray-900 dark:text-white">
              {section.title}
            </h2>
            <div className="space-y-4 text-lg leading-relaxed text-gray-700 dark:text-gray-300">
              {section.content.split('\n').map((line, j) => (
                <p key={j} className="pl-4 border-l-4 border-primary/20">{line}</p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
