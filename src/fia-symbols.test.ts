import { it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { fiaSymbolName } from './fia-symbols';
const files = readdirSync(
  new URL('../assets/fia-symbols/svg/glyphs', import.meta.url)
).map(x => x.replace(/\.svg$/, ''));
it('maps RN labels to existing FIA files without mixing danger levels or red variants', () => {
  expect(fiaSymbolName('2 Danger', files)).toBe('danger-2');
  expect(fiaSymbolName('Danger Level 1', files)).toBe('danger-1');
  expect(fiaSymbolName('Less Visible (Red in Tulip)', files)).toBe(
    'less-visible-red'
  );
  expect(fiaSymbolName('Train Tracks', files)).toBe('railroad');
  expect(fiaSymbolName('Speed Limit 90', files)).toBe('speed-90');
  expect(fiaSymbolName('Speed Limit 90 End', files)).toBe('speed-90-end');
  expect(fiaSymbolName('Fort / Castle', files)).toBe('fort-castle_1');
  expect(fiaSymbolName('unknown custom hazard', files)).toBeUndefined();
  expect(fiaSymbolName('', files)).toBeUndefined();
});
