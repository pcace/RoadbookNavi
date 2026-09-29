export type SurfaceInfo = {
  key: string;
  group: 'paved' | 'unpaved' | 'special' | 'unknown';
  labels: { de: string; en: string };
  aliases?: string[];
};

// Comprehensive list of commonly used OSM surface values. See: https://wiki.openstreetmap.org/wiki/Key:surface
export const SURFACES: SurfaceInfo[] = [
  // Paved
  { key: 'paved', group: 'paved', labels: { de: 'befestigt', en: 'paved' } },
  { key: 'asphalt', group: 'paved', labels: { de: 'Asphalt', en: 'asphalt' } },
  { key: 'concrete', group: 'paved', labels: { de: 'Beton', en: 'concrete' } },
  {
    key: 'concrete:lanes',
    group: 'paved',
    labels: { de: 'Betonspuren', en: 'concrete lanes' },
  },
  {
    key: 'concrete:plates',
    group: 'paved',
    labels: { de: 'Betonplatten', en: 'concrete plates' },
  },
  {
    key: 'paving_stones',
    group: 'paved',
    labels: { de: 'Pflastersteine', en: 'paving stones' },
    aliases: ['paving-stones'],
  },
  {
    key: 'sett',
    group: 'paved',
    labels: { de: 'Kleinpflaster (Basalt)', en: 'sett' },
  },
  {
    key: 'cobblestone',
    group: 'paved',
    labels: { de: 'Kopfsteinpflaster', en: 'cobblestone' },
  },
  {
    key: 'unhewn_cobblestone',
    group: 'paved',
    labels: { de: 'Grobes Kopfsteinpflaster', en: 'unhewn cobblestone' },
  },
  {
    key: 'brick',
    group: 'paved',
    labels: { de: 'Ziegel', en: 'brick' },
    aliases: ['bricks'],
  },
  { key: 'metal', group: 'paved', labels: { de: 'Metall', en: 'metal' } },
  { key: 'wood', group: 'paved', labels: { de: 'Holz', en: 'wood' } },

  // Unpaved (loose/soft)
  {
    key: 'unpaved',
    group: 'unpaved',
    labels: { de: 'unbefestigt', en: 'unpaved' },
  },
  {
    key: 'compacted',
    group: 'unpaved',
    labels: { de: 'verdichtet', en: 'compacted' },
  },
  {
    key: 'fine_gravel',
    group: 'unpaved',
    labels: { de: 'Feinkies', en: 'fine gravel' },
  },
  {
    key: 'gravel',
    group: 'unpaved',
    labels: { de: 'Schotter/Kies', en: 'gravel' },
  },
  {
    key: 'crushed_stone',
    group: 'unpaved',
    labels: { de: 'Schotter (gebrochen)', en: 'crushed stone' },
  },
  {
    key: 'pebblestone',
    group: 'unpaved',
    labels: { de: 'Kiesel', en: 'pebblestone' },
  },
  {
    key: 'ground',
    group: 'unpaved',
    labels: { de: 'Boden', en: 'ground' },
    aliases: ['earth', 'soil'],
  },
  { key: 'dirt', group: 'unpaved', labels: { de: 'Erde/Lehm', en: 'dirt' } },
  { key: 'clay', group: 'unpaved', labels: { de: 'Lehm', en: 'clay' } },
  { key: 'sand', group: 'unpaved', labels: { de: 'Sand', en: 'sand' } },
  { key: 'mud', group: 'unpaved', labels: { de: 'Schlamm', en: 'mud' } },
  { key: 'grass', group: 'unpaved', labels: { de: 'Gras', en: 'grass' } },
  {
    key: 'grass_paver',
    group: 'unpaved',
    labels: { de: 'Rasengittersteine', en: 'grass paver' },
    aliases: ['grass_pavers'],
  },
  { key: 'rock', group: 'unpaved', labels: { de: 'Fels', en: 'rock' } },
  { key: 'stone', group: 'unpaved', labels: { de: 'Stein', en: 'stone' } },
  {
    key: 'bedrock',
    group: 'unpaved',
    labels: { de: 'Felsgrund', en: 'bedrock' },
  },
  {
    key: 'woodchips',
    group: 'unpaved',
    labels: { de: 'Holzhackschnitzel', en: 'woodchips' },
  },
  {
    key: 'cinder',
    group: 'unpaved',
    labels: { de: 'Schlacke', en: 'cinder' },
    aliases: ['cinders'],
  },
  {
    key: 'shells',
    group: 'unpaved',
    labels: { de: 'Muschelschalen', en: 'shells' },
    aliases: ['shell'],
  },
  {
    key: 'laterite',
    group: 'unpaved',
    labels: { de: 'Laterit', en: 'laterite' },
  },

  // Special / sports / weather
  { key: 'tartan', group: 'special', labels: { de: 'Tartan', en: 'tartan' } },
  { key: 'rubber', group: 'special', labels: { de: 'Gummi', en: 'rubber' } },
  {
    key: 'plastic',
    group: 'special',
    labels: { de: 'Kunststoff', en: 'plastic' },
  },
  {
    key: 'artificial_turf',
    group: 'special',
    labels: { de: 'Kunstrasen', en: 'artificial turf' },
  },
  { key: 'ice', group: 'special', labels: { de: 'Eis', en: 'ice' } },
  { key: 'snow', group: 'special', labels: { de: 'Schnee', en: 'snow' } },

  // Unknown / fallback
  {
    key: 'unknown',
    group: 'unknown',
    labels: { de: 'Unbekannt', en: 'unknown' },
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

export function getSurfaceLabel(key: string, lang: 'de' | 'en' = 'de'): string {
  const info = getSurfaceInfo(key);
  return lang === 'en' ? info.labels.en : info.labels.de;
}
