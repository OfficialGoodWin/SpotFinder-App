import React, { useState } from 'react';
import { ChevronDown, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/lib/LanguageContext';

const FAQS = [
  {
    category: 'Getting Started',
    items: [
      {
        q: 'What is Spotfinder?',
        a: 'Spotfinder is a community map app for discovering and sharing useful spots — parking areas, food stops, toilets, and more. You can add spots yourself, rate them, and navigate directly to any spot.'
      },
      {
        q: 'Do I need an account to use Spotfinder?',
        a: 'No! You can browse, add spots, and rate them without an account. Creating an account lets you manage your spots later.'
      },
      {
        q: 'How do I create an account?',
        a: 'Tap the Account button at the bottom-left of the screen and choose Sign In. You can register with an email and password, or sign in instantly with your Google account.'
      },
    ]
  },
  {
    category: 'Spots',
    items: [
      {
        q: 'How do I add a spot?',
        a: 'Tap the green + button at the bottom of the screen. The map will enter "add mode" — tap anywhere on the map to place your spot, then fill in the details.'
      },
      {
        q: 'What types of spots can I add?',
        a: 'Currently you can add Parking 🅿️, Food 🍽️, and Toilet 🚽 spots. More categories are coming soon.'
      },
      {
        q: 'How do I see nearby spots?',
        a: 'Tap the spots button (the tree + car icon) in the top search bar to reveal all spots on the map and open the nearby list, sorted by distance from your location.'
      },
      {
        q: 'Can I delete a spot I added?',
        a: 'Yes. Tap the spot on the map, then in the detail popup tap the delete button. You can only delete spots you created.'
      },
      {
        q: 'How do I rate a spot?',
        a: 'Tap on any spot marker to open its detail panel, then tap the star rating. Ratings are averaged across all users.'
      },
    ]
  },
  {
    category: 'Navigation',
    items: [
      {
        q: 'How do I navigate to a spot?',
        a: 'Tap a spot marker on the map to open its detail popup, then press Navigate. Alternatively, tap the arrow icon next to any spot in the nearby list.'
      },
      {
        q: 'What routing does Spotfinder use?',
        a: 'Spotfinder uses OSRM (Open Source Routing Machine), a fast free routing engine. It supports driving, cycling, and walking routes.'
      },
      {
        q: 'Does it give voice directions?',
        a: 'Yes! When navigation starts the app speaks turn-by-turn instructions including road names, numbers (like D5), and destination signs. Use the speaker button to mute.'
      },
      {
        q: 'Can I navigate to an address I search for?',
        a: 'Yes. Type any address or place in the search bar, then tap the arrow icon next to the result to start navigation.'
      },
    ]
  },
  {
    category: 'Map & Traffic',
    items: [
      {
        q: 'How do I switch the map style?',
        a: 'Tap the layers icon in the top-right corner of the map. You can choose Basic, Outdoor, Satellite, Winter, or Traffic view.'
      },
      {
        q: 'What does the Traffic layer show?',
        a: 'The Traffic layer overlays real-time traffic flow on top of the map — green means free flow, yellow means slow, red means heavy congestion. Road closure and traffic jam icons appear when detected. Requires a TomTom API key configured by the app developer.'
      },
      {
        q: 'Does Spotfinder work offline?',
        a: 'Map tiles and live traffic require an internet connection. The app itself loads cached data where possible but full functionality needs connectivity.'
      },
      {
        q: 'Why is my GPS dot inaccurate?',
        a: 'GPS accuracy depends on your device and environment. Indoors or in dense cities accuracy can be lower. The light blue circle around your dot represents the estimated accuracy radius.'
      },
    ]
  },
  {
    category: 'Account & Privacy',
    items: [
      {
        q: 'Are spots I add public?',
        a: 'Yes, spots you create are visible to all users of the app. This is by design — the app is a community sharing platform.'
      },
      {
        q: 'How do I delete my account?',
        a: 'Go to Settings → tap your Account button → Delete Account. You will be asked to type DELETE to confirm. Note that backend deletion requires contacting support.'
      },
      {
        q: 'Where is my data stored?',
        a: 'Spot data and user accounts are stored securely in Firebase (Google Cloud). Authentication credentials are handled by Firebase Auth.'
      },
    ]
  },
];

function AccordionItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border-b border-gray-100 dark:border-border last:border-0 transition-colors ${open ? 'bg-gray-50 dark:bg-accent/40' : ''}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left gap-4"
      >
        <span className="text-sm font-semibold text-gray-800 dark:text-foreground">{q}</span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <p className="px-5 pb-4 text-sm text-gray-600 dark:text-muted-foreground leading-relaxed">
          {a}
        </p>
      )}
    </div>
  );
}

export default function FAQ() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-lg font-bold">{t('faq.title')}</h1>
          <p className="text-xs text-muted-foreground">{t('faq.backToMap')}</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {FAQS.map(section => (
          <div key={section.category}>
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-2 px-1">
              {section.category}
            </h2>
            <div className="bg-white dark:bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-border overflow-hidden">
              {section.items.map(item => (
                <AccordionItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </div>
        ))}

        <p className="text-center text-xs text-muted-foreground pb-8">{t('faq.needHelp') || 'Still need help? Use the Feedback form in Settings.'}</p>
      </div>
    </div>
  );
}
