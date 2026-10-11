// Human-reviewed compatibility data for legacy records created before a spot
// name was required. Each identity is supported by the contributor's public
// description and a named OSM object at the submitted coordinates. This is
// intentionally small: ambiguous nearby features are not included.
export const REVIEWED_LEGACY_SPOTS = Object.freeze({
  AIyFTk1eTE7gD5INyomX: {
    title: 'Blejski grad', locality: 'Bled', category: 'castle',
    evidence: { source: 'OpenStreetMap', osm_type: 'relation', osm_id: 18012745, distance_m: 15 },
  },
  K20qivFHwrGzBgBoYZW2: {
    title: 'Hlavatice', locality: 'Turnov', category: 'viewpoint',
    evidence: { source: 'OpenStreetMap', osm_type: 'node', osm_id: 442644909, distance_m: 2 },
  },
  N9TILMoRCl4dN5Ah7plP: {
    title: 'Zugspitze', locality: 'Grainau', category: 'mountain',
    evidence: { source: 'OpenStreetMap', osm_type: 'node', osm_id: 27384190, distance_m: 8 },
  },
  REfS8qWjqf1HSaRIoSju: {
    title: 'Schloss Neuschwanstein', locality: 'Schwangau', category: 'castle',
    evidence: { source: 'OpenStreetMap', osm_type: 'way', osm_id: 221601969, distance_m: 3 },
  },
  T0yooHmhTpf4xS0NjAXm: {
    title: 'Zamek w Malborku', locality: 'Malbork', category: 'castle',
    evidence: { source: 'OpenStreetMap', osm_type: 'relation', osm_id: 6436433, distance_m: 30 },
  },
  YfzdxI4GvZqCGDdR4BnG: {
    title: 'Pyramidenkogel', locality: 'Keutschach am See', category: 'mountain',
    evidence: { source: 'OpenStreetMap', osm_type: 'node', osm_id: 9897464798, distance_m: 7 },
  },
});

const meaningful = value => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length >= 2 && !/^(?:spot|place|location|point|poi|unnamed(?:\s+.+)?)$/i.test(text);
};

export function applyReviewedLegacyIdentity(spot = {}) {
  const reviewed = REVIEWED_LEGACY_SPOTS[spot.id];
  if (!reviewed || meaningful(spot.title) || meaningful(spot.resolved_title)) return spot;
  return {
    ...spot,
    resolved_title: reviewed.title,
    resolved_title_source: 'reviewed_osm_coordinate_match',
    resolved_title_confidence: 'high',
    resolved_category: reviewed.category,
    locality: spot.locality || reviewed.locality,
    identity_evidence: reviewed.evidence,
  };
}
