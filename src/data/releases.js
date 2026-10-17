import { APP_VERSION, CURRENT_RELEASE_DATE } from '../config/appVersion.js';

const releases = [
  {
    version: APP_VERSION,
    date: CURRENT_RELEASE_DATE,
    title: 'Better discovery and more reliable trips',
    summary: 'A focused update to map discovery, spot details, contributions, mobile controls, and privacy safeguards.',
    changes: {
      added: [
        'A dedicated Updates page for release notes.',
        'Featured community places and Nearby filters for distance, origin, and minimum rating.',
        'Private spot drafts and a collection view for saved, liked, and contributed places.',
      ],
      improved: [
        'Spot and POI details show clearer names, photo galleries, attribution, ratings, and practical information.',
        'Directions open in Google Maps, Mapy.com, or Apple Maps; SpotFinder keeps the selected provider preference.',
        'Map styles, GPS display, and key dialogs work more reliably on small screens.',
      ],
      fixed: [
        'Featured cards can use the same authorized photos shown in Spot Details.',
        'The duplicate guest Nearby control was removed; the remaining entry opens the existing filter dialog.',
        'Map marker initialization now waits for valid coordinates, preventing the undefined-location crash.',
        'Photo galleries avoid repeating the same picture, and draft operations provide more accurate feedback.',
      ],
      security: [
        'Account deletion now requires recent authentication and uses server-controlled cleanup.',
        'Authorization, private draft storage, upload validation, and social-link validation were tightened.',
        'Google Analytics, Firebase Analytics, Tag Manager, and AdSense are temporarily disabled; historical optional-consent choices cannot reactivate them.',
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

