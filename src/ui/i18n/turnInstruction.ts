import i18n from './index';

// Translate generated legacy instructions at display time. Stored turn text and
// user-authored notes remain intact, as core filtering relies on these markers.
export function turnInstruction(instruction: string): string {
  const directions: Record<string, string> = {
    Geradeaus: 'straight',
    Rechts: 'right',
    Links: 'left',
    'Scharf rechts': 'sharpRight',
    'Scharf links': 'sharpLeft',
    'Leicht rechts': 'slightRight',
    'Leicht links': 'slightLeft',
    Wenden: 'uturn',
    Start: 'start',
    'Ziel erreicht': 'finish',
  };
  const terrain: Record<string, string> = {
    Feldweg: 'track',
    Landstraße: 'secondary',
    Kreisstraße: 'tertiary',
    Ortsstraße: 'residential',
  };
  const [direction, surface] = instruction.split(' auf ');
  const key = directions[direction];
  if (key) {
    const translated = i18n.t(`roadbook:instructions.${key}`);
    return surface && terrain[surface]
      ? i18n.t('roadbook:instructions.withTerrain', {
          direction: translated,
          terrain: i18n.t(`roadbook:instructions.${terrain[surface]}`),
        })
      : surface
        ? instruction
        : translated;
  }
  const entry = /^Eintrag (\d+)$/.exec(instruction);
  return entry
    ? i18n.t('roadbook:instructions.entry', { number: entry[1] })
    : instruction;
}
