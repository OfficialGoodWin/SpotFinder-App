import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/lib/LanguageContext';

const TERMS_CONTENT = {
  en: {
    title: 'Terms of Service',
    back: 'Back to Map',
    lastUpdated: 'Last updated: December 2024',
    intro: `Welcome to SpotFinder. By using our service, you agree to these terms.`,
    sections: [
      {
        title: 'Acceptable Use',
        content: `• Add helpful spots (parking, viewpoints, rest areas)\n• No spam, illegal content, or harmful locations\n• Respect privacy — no personal addresses`
      },
      {
        title: 'Community Guidelines',
        content: `• Be accurate and helpful\n• Rate honestly\n• Photos: relevant to the spot only\n• No advertising`
      },
      {
        title: 'Content Ownership',
        content: `Spots you create are public/community property. You retain photo rights but grant us display license.`
      },
      {
        title: 'Navigation Disclaimer',
        content: `Routes are community-generated. Always obey traffic laws. Not liable for navigation errors.`
      },
      {
        title: 'Moderation',
        content: `Superadmins can remove inappropriate content. No automated moderation. Report via feedback.`
      },
      {
        title: 'Liability',
        content: `Service "as is". No warranty. Not responsible for user-generated content accuracy.`
      },
      {
        title: 'Changes',
        content: `We may update terms. Continued use = acceptance. Check periodically.`
      },
      {
        title: 'Contact',
        content: `Questions? support@spotfinder.app`
      }
    ]
  },
  // Translations...
  cs: {
    title: 'Podmínky používání',
    back: 'Zpět na mapu',
    lastUpdated: 'Naposledy aktualizováno: Prosinec 2024',
    // ...
  }
};

export default function TermsOfService() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const content = TERMS_CONTENT[language] || TERMS_CONTENT.en;

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
