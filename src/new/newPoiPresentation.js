import { getCategoryName } from '@/lib/POICategories';

const clean = value => typeof value === 'string' ? value.trim() : '';
const identifier = value => /^\d+$|^-?\d+(?:\.\d+)?\s*[,;]\s*-?\d+(?:\.\d+)?$|^(?:node|way|relation|osm|place_id)[\s:_-]*\d+$/i.test(value);

export function newPoiText(poi, category, language, visibleText) {
  const categoryLabel = getCategoryName(category, language) || (language?.startsWith('cs') ? 'Místo na mapě' : 'Place on map');
  const address = clean(poi?.address);
  const candidates = [visibleText?.name, visibleText?.originalName, poi?.tags?.name];
  const addressKey = address.toLocaleLowerCase();
  const name = candidates.map(clean).find(value => {
    const key = value.toLocaleLowerCase();
    return value && !identifier(value) && key !== addressKey && !addressKey.startsWith(`${key},`);
  });
  return { title: name || categoryLabel, hasName: Boolean(name), categoryLabel, address };
}
