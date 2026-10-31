import { describe, expect, it } from 'vitest';
import { roadbookContentHeight } from './pdfLayout';

const text = (str: string, y: number, height = 1) => ({
  str,
  dir: 'ltr',
  width: 2,
  height,
  transform: [1, 0, 0, 1, 6, y],
  fontName: 'helvetica',
  hasEOL: false,
});

describe('roadbook screen PDF height', () => {
  it('ends after the last complete entry on a mostly empty final page', () => {
    expect(
      roadbookContentHeight(2050, [
        text('#39', 2048.15),
        text('#40', 1948.15),
        text('Finish', 1940, 8),
      ])
    ).toBeCloseTo(201.85);
  });

  it('retains the title and complete row in a short single-page roadbook', () => {
    expect(roadbookContentHeight(2050, [text('#1', 1798.15)])).toBeCloseTo(
      351.85
    );
  });

  it('handles split markers without mistaking normal notes for row markers', () => {
    expect(
      roadbookContentHeight(2050, [
        text('#', 2048.15),
        text('39', 2048.15),
        text('#40', 1948.15),
        text('#123', 1880, 8),
      ])
    ).toBeCloseTo(201.85);
  });

  it('keeps full pages and safely falls back when markers are absent or invalid', () => {
    expect(roadbookContentHeight(2050, [text('#18', 98.15)])).toBe(2050);
    expect(roadbookContentHeight(2050, [text('Finish', 1900, 8)])).toBe(2050);
    expect(
      roadbookContentHeight(2050, [
        text('#0', 2000),
        text('#1', NaN),
        text('#2', 2100),
        text('#3', -100),
      ])
    ).toBe(2050);
  });
});
