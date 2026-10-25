import { getVerifiedSpotCategory } from '@/lib/spotPresentation';

export const MAP_HOME_CATEGORIES = ['Vše', 'Výhledy', 'Túry', 'Voda', 'Jídlo'];

export function mapHomeCategoryOf(spot) {
  const category = String(getVerifiedSpotCategory(spot) || '').toLowerCase();
  if (/waterfall|swim|water|lake|river|beach/.test(category)) return 'Voda';
  if (/cafe|caf|food|restaurant/.test(category)) return 'Jídlo';
  if (/hike|trail|mountain|walking/.test(category)) return 'Túry';
  if (/viewpoint|sunset|sunrise|photo/.test(category)) return 'Výhledy';
  return 'Ostatní';
}
