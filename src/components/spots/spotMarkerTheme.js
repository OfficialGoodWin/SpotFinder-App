import {
  Building2,
  Camera,
  Coffee,
  Footprints,
  Landmark,
  MapPin,
  Mountain,
  Sunrise,
  Waves,
} from 'lucide-react';

const THEMES = {
  sunset: {
    label: 'Sunset',
    Icon: Sunrise,
    accent: '#fb7185',
    accentStrong: '#f59e0b',
    glow: 'rgba(251, 113, 133, .42)',
    gradient: 'linear-gradient(145deg, rgba(255,247,237,.94), rgba(255,228,230,.82))',
  },
  sunrise: {
    label: 'Sunrise',
    Icon: Sunrise,
    accent: '#f97316',
    accentStrong: '#facc15',
    glow: 'rgba(249, 115, 22, .42)',
    gradient: 'linear-gradient(145deg, rgba(255,251,235,.94), rgba(254,215,170,.82))',
  },
  waterfall: {
    label: 'Waterfall',
    Icon: Waves,
    accent: '#06b6d4',
    accentStrong: '#2563eb',
    glow: 'rgba(6, 182, 212, .42)',
    gradient: 'linear-gradient(145deg, rgba(236,254,255,.94), rgba(219,234,254,.84))',
  },
  secretcafe: {
    label: 'Secret Café',
    Icon: Coffee,
    accent: '#b7791f',
    accentStrong: '#78350f',
    glow: 'rgba(180, 83, 9, .38)',
    gradient: 'linear-gradient(145deg, rgba(255,251,235,.95), rgba(231,211,177,.86))',
  },
  urbanexplore: {
    label: 'Urban Explore',
    Icon: Building2,
    accent: '#8b5cf6',
    accentStrong: '#5b21b6',
    glow: 'rgba(139, 92, 246, .42)',
    gradient: 'linear-gradient(145deg, rgba(245,243,255,.94), rgba(221,214,254,.84))',
  },
  viewpoint: {
    label: 'Viewpoint',
    Icon: Mountain,
    accent: '#10b981',
    accentStrong: '#047857',
    glow: 'rgba(16, 185, 129, .40)',
    gradient: 'linear-gradient(145deg, rgba(236,253,245,.95), rgba(209,250,229,.84))',
  },
  photospot: {
    label: 'Photo Spot',
    Icon: Camera,
    accent: '#ec4899',
    accentStrong: '#be185d',
    glow: 'rgba(236, 72, 153, .40)',
    gradient: 'linear-gradient(145deg, rgba(253,242,248,.95), rgba(252,231,243,.84))',
  },
  hike: {
    label: 'Hike',
    Icon: Footprints,
    accent: '#84cc16',
    accentStrong: '#3f6212',
    glow: 'rgba(132, 204, 22, .38)',
    gradient: 'linear-gradient(145deg, rgba(247,254,231,.95), rgba(220,252,231,.84))',
  },
  ruin: {
    label: 'Ruin',
    Icon: Landmark,
    accent: '#a16207',
    accentStrong: '#713f12',
    glow: 'rgba(161, 98, 7, .36)',
    gradient: 'linear-gradient(145deg, rgba(254,252,232,.95), rgba(231,229,228,.86))',
  },
};

const FALLBACK = {
  label: 'Spot',
  Icon: MapPin,
  accent: '#10b981',
  accentStrong: '#047857',
  glow: 'rgba(16, 185, 129, .40)',
  gradient: 'linear-gradient(145deg, rgba(240,253,250,.95), rgba(209,250,229,.84))',
};

export function normalizeSpotCategory(category) {
  return String(category || '').replace(/^#/, '').replace(/[\s_-]/g, '').toLowerCase();
}

export function getSpotMarkerTheme(category) {
  return THEMES[normalizeSpotCategory(category)] || { ...FALLBACK, label: category || FALLBACK.label };
}

export function getSpotRating(spot) {
  const rating = Number(spot?.rating);
  return Number.isFinite(rating) && rating > 0 ? Math.min(5, Math.max(0, rating)).toFixed(1) : 'New';
}

