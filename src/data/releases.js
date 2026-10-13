import { APP_VERSION, CURRENT_RELEASE_DATE } from '../config/appVersion.js';

const releases = [
  {
    version: APP_VERSION,
    date: CURRENT_RELEASE_DATE,
    title: 'Clearer discovery, safer accounts',
    summary: 'A focused update to adding and understanding spots, responsive everyday controls, and privacy and account safeguards.',
    changes: {
      added: [
        'A dedicated Updates page for release notes.',
        'Map discovery guidance and clearer first-visit help.',
        'Private spot drafts with recovery for interrupted contributions.',
      ],
      improved: [
        'Spot names, location context, Add Spot, and Spot Details are clearer and more consistent.',
        'Settings and key dialogs adapt more reliably to small screens and larger text.',
        'Nearby results distinguish unrated places and use consistent distance and rating filters.',
      ],
      fixed: [
        'Help content and tutorials now match required fields, optional enrichment, and current rating categories.',
        'Voice-search, location, and contribution failures provide more actionable messages.',
        'Several modal containment, map focus, and permission edge cases were corrected.',
      ],
      security: [
        'Account deletion now requires recent authentication and uses server-controlled cleanup.',
        'Authorization, private draft storage, upload validation, and social-link validation were tightened.',
        'Google Analytics and AdSense are temporarily disabled; historical optional-consent choices cannot reactivate them.',
      ],
    },
  },
];

const categories = ['added', 'improved', 'fixed', 'security'];

function validateRelease(release) {
  if (!/^\d+\.\d+\.\d+$/.test(release.version)) throw new Error(`Invalid release version: ${release.version}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(release.date)) throw new Error(`Invalid release date: ${release.date}`);
  if (!release.title?.trim() || !release.summary?.trim()) throw new Error(`Incomplete release ${release.version}`);
  categories.forEach(category => {
    if (!Array.isArray(release.changes?.[category])) throw new Error(`Missing ${category} changes for ${release.version}`);
  });
  return release;
}

export const RELEASE_CATEGORIES = Object.freeze(categories);
export const RELEASES = Object.freeze(releases.map(validateRelease));
export const CURRENT_RELEASE = RELEASES[0];

