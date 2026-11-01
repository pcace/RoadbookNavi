import de from '../../../i18n/locales/de/routeBuilder.json';
import en from '../../../i18n/locales/en/routeBuilder.json';
import es from '../../../i18n/locales/es/routeBuilder.json';
import fr from '../../../i18n/locales/fr/routeBuilder.json';
import { normalizeLanguage } from '../../../i18n/languages';

export type SurfaceInfo = {
  key: string;
  group: 'paved' | 'unpaved' | 'special' | 'unknown';
  aliases?: string[];
};

// Comprehensive list of commonly used OSM surface values. See: https://wiki.openstreetmap.org/wiki/Key:surface
export const SURFACES: SurfaceInfo[] = [
  // Paved
  { key: 'paved', group: 'paved' },
  { key: 'asphalt', group: 'paved' },
  { key: 'concrete', group: 'paved' },
  {
    key: 'concrete:lanes',
    group: 'paved',
  },
  {
    key: 'concrete:plates',
    group: 'paved',
  },
  {
    key: 'paving_stones',
    group: 'paved',
    aliases: ['paving-stones'],
  },
  {
    key: 'sett',
    group: 'paved',
  },
  {
    key: 'cobblestone',
    group: 'paved',
  },
  {
    key: 'unhewn_cobblestone',
    group: 'paved',
  },
  {
    key: 'brick',
    group: 'paved',
    aliases: ['bricks'],
  },
  { key: 'metal', group: 'paved' },
  { key: 'wood', group: 'paved' },

  // Unpaved (loose/soft)
  {
    key: 'unpaved',
    group: 'unpaved',
  },
  {
    key: 'compacted',
    group: 'unpaved',
  },
  {
    key: 'fine_gravel',
    group: 'unpaved',
  },
  {
    key: 'gravel',
    group: 'unpaved',
  },
  {
    key: 'crushed_stone',
    group: 'unpaved',
  },
  {
    key: 'pebblestone',
    group: 'unpaved',
  },
  {
    key: 'ground',
    group: 'unpaved',
    aliases: ['earth', 'soil'],
  },
  { key: 'dirt', group: 'unpaved' },
  { key: 'clay', group: 'unpaved' },
  { key: 'sand', group: 'unpaved' },
  { key: 'mud', group: 'unpaved' },
  { key: 'grass', group: 'unpaved' },
  {
    key: 'grass_paver',
    group: 'unpaved',
    aliases: ['grass_pavers'],
  },
  { key: 'rock', group: 'unpaved' },
  { key: 'stone', group: 'unpaved' },
  {
    key: 'bedrock',
    group: 'unpaved',
  },
  {
    key: 'woodchips',
    group: 'unpaved',
  },
  {
    key: 'cinder',
    group: 'unpaved',
    aliases: ['cinders'],
  },
  {
    key: 'shells',
    group: 'unpaved',
    aliases: ['shell'],
  },
  {
    key: 'laterite',
    group: 'unpaved',
  },

  // Special / sports / weather
  { key: 'tartan', group: 'special' },
  { key: 'rubber', group: 'special' },
  {
    key: 'plastic',
    group: 'special',
  },
  {
    key: 'artificial_turf',
    group: 'special',
  },
  { key: 'ice', group: 'special' },
  { key: 'snow', group: 'special' },

  // Unknown / fallback
  {
    key: 'unknown',
    group: 'unknown',
  },
];

const ALIAS_TO_KEY: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const s of SURFACES) {
    if (s.aliases) {
      for (const a of s.aliases) map[a] = s.key;
    }
  }
  return map;
})();

const KEY_TO_INFO: Record<string, SurfaceInfo> = Object.fromEntries(
  SURFACES.map(s => [s.key, s])
);

export function normalizeSurfaceKey(input: string | undefined | null): string {
  if (!input) return 'unknown';
  const k = String(input).toLowerCase();
  return KEY_TO_INFO[k] ? k : ALIAS_TO_KEY[k] || 'unknown';
}

export function getSurfaceInfo(key: string): SurfaceInfo {
  const norm = normalizeSurfaceKey(key);
  return KEY_TO_INFO[norm] || KEY_TO_INFO['unknown'];
}

export function getSurfaceLabel(key: string, lang: string = 'en'): string {
  const surfaces = {
    de: de.surfaces,
    en: en.surfaces,
    es: es.surfaces,
    fr: fr.surfaces,
  }[normalizeLanguage(lang)];
  return surfaces[normalizeSurfaceKey(key) as keyof typeof surfaces];
}
