import { SPOT_CATEGORY_KEYS, spotPrimaryCategory } from '@/lib/spotCategories';

// `Vše` is the existing sentinel used by the redesigned map filter. Category
// values are canonical keys; legacy primary values resolve through the shared
// category module, so no Firestore migration is needed.
export const MAP_HOME_ALL = 'Vše';
export const MAP_HOME_CATEGORY_KEYS = SPOT_CATEGORY_KEYS;
export const MAP_HOME_CATEGORIES = [MAP_HOME_ALL, ...SPOT_CATEGORY_KEYS];

export function mapHomeCategoryOf(spot) {
  return spotPrimaryCategory(spot);
}
