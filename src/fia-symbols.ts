// RN display names -> Tulip/FIA filenames. Unknown symbols stay placeholders.
export const normalizeSymbol = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]/g, '');
const aliases: Record<string, string> = {
  '1 Danger': 'danger-1',
  'Danger Level 1': 'danger-1',
  '2 Danger': 'danger-2',
  '3 Danger': 'danger-3',
  'And / Next': 'abbr-ET',
  'Barbed Fence': 'barbed-wire-fence',
  Bivouac: 'camp',
  Bushes: 'bush',
  'Dip Hole': 'dip',
  'Large Wash': 'big-wadi',
  'Small Wash': 'small-wadi',
  Plain: 'plain-chott',
  'Plain / Chott': 'plain-chott',
  'Sandy Wash': 'sandy-wadi',
  'Sandy crest': 'broken-dune',
  'Small Dunes': 'dunette',
  'Small Rocks': 'rocks',
  'Power Line': 'electric-line',
  'Train Tracks': 'railroad',
  'Right Over Brow': 'right-over-crest',
  'Reset to Distance to Zero': 'reset-distance',
  'Quit   Leave': 'leave',
  'Quit / Leave': 'leave',
  'Less Visible (Red in Tulip)': 'less-visible-red',
  Imperative: 'abbr-IMP',
  'Off Piste': 'abbr-HP',
  Rejoin: 'abbr-RO',
  'Follow Road': 'abbr-SA',
  'Principal Track / Piste': 'big-track',
  Vegetation: 'vegetation-1',
  Grass: 'tall-grass',
  'Fort / Castle': 'fort-castle_1',
  'Media Zone': 'media',
  'Medical Vehical Point': 'medical-vehicle-point',
  Wadi: 'wash',
  'Speed Limit 40': 'speed-40',
  '50 Meter': 'distance50',
  '150 meters': 'distance150',
};
const lookup = Object.fromEntries(
  Object.entries(aliases).map(([k, v]) => [normalizeSymbol(k), v])
);
export function fiaSymbolName(
  name: string,
  files: string[]
): string | undefined {
  const normalized = normalizeSymbol(name);
  if (!normalized) return;
  const alias = lookup[normalized];
  if (alias && files.includes(alias)) return alias;
  const exact = files.filter(file => normalizeSymbol(file) === normalized);
  if (exact.length === 1) return exact[0];
  const speed = name.match(/^speed limit\s+(\d+)(?:\s+(end))?$/i);
  const candidate = speed
    ? `speed-${speed[1]}${speed[2] ? '-end' : ''}`
    : undefined;
  return candidate && files.includes(candidate) ? candidate : undefined;
}
