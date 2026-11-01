import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import i18n from './index';
import {
  languageLocale,
  normalizeLanguage,
  supportedLanguages,
} from './languages';
import { getSurfaceLabel } from '../components/RouteBuilder/utils/surfaces';
import { profileLabel } from './profileLabel';
import { turnInstruction } from './turnInstruction';

const locales = import.meta.glob('./locales/*/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, Record<string, unknown>>;

function strings(
  value: Record<string, unknown>,
  prefix = ''
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return typeof value === 'string'
        ? [[path, value]]
        : Object.entries(strings(value as Record<string, unknown>, path));
    })
  );
}

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('language support', () => {
  it.each([
    ['de-DE', 'de'],
    ['EN_us', 'en'],
    ['es-MX', 'es'],
    ['FR-ca', 'fr'],
    ['it', 'en'],
    ['', 'en'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeLanguage(input)).toBe(expected);
  });

  it('keeps every namespace and interpolation complete in all four languages', () => {
    for (const namespace of [
      'common',
      'roadbook',
      'routeBuilder',
      'settings',
    ]) {
      const reference = strings(locales[`./locales/en/${namespace}.json`]);
      for (const language of supportedLanguages) {
        const translated = strings(
          locales[`./locales/${language}/${namespace}.json`]
        );
        expect(
          Object.keys(translated).sort(),
          `${language}/${namespace}`
        ).toEqual(Object.keys(reference).sort());
        for (const [key, value] of Object.entries(translated)) {
          expect(value.trim(), `${language}/${namespace}/${key}`).not.toBe('');
          expect(
            value.match(/{{[^}]+}}/g)?.sort() ?? [],
            `${language}/${namespace}/${key}`
          ).toEqual(reference[key].match(/{{[^}]+}}/g)?.sort() ?? []);
        }
      }
    }
  });

  it('provides translations for literal UI keys without falling back to English', () => {
    const sourceRoot = fileURLToPath(new URL('../../', import.meta.url));
    for (const file of readdirSync(sourceRoot, {
      recursive: true,
    }) as string[]) {
      if (!/\.tsx?$/.test(file) || file.endsWith('.test.ts')) continue;
      const code = readFileSync(`${sourceRoot}/${file}`, 'utf8');
      for (const match of code.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)) {
        for (const language of supportedLanguages) {
          expect(
            i18n.exists(match[1], {
              lng: language,
              fallbackLng: false,
              count: 1,
            }),
            `${language}: ${file}: ${match[1]}`
          ).toBe(true);
        }
      }
    }
  });

  it('provides native and browser help with existing local media in every language', () => {
    for (const language of supportedLanguages) {
      for (const platform of ['native', 'web']) {
        const help = readFileSync(
          new URL(
            `../../../public/help/${platform}-${language}.md`,
            import.meta.url
          ),
          'utf8'
        );
        expect(help).toMatch(/^# /);
        for (const match of help.matchAll(/src="(\/help\/[^\"]+)"/g)) {
          expect(() =>
            readFileSync(new URL(`../../../public${match[1]}`, import.meta.url))
          ).not.toThrow();
        }
      }
    }
  });

  it('localizes surfaces containing colons, regional locales and bundled profile labels', async () => {
    await i18n.changeLanguage('fr');
    expect(
      i18n.t('surfaces.concrete:lanes', {
        ns: 'routeBuilder',
        nsSeparator: false,
      })
    ).toBe('bandes de béton');
    expect(getSurfaceLabel('paving-stones', 'es-MX')).toBe('adoquines');
    expect(getSurfaceLabel('unknown-tag', 'fr-CA')).toBe('inconnu');
    expect(profileLabel('enduro-easy', 'es')).toBe('Enduro (fácil)');
    expect(profileLabel('custom-profile', 'fr')).toBe('custom-profile');
    expect(languageLocale('fr-CA')).toBe('fr-FR');
    expect(turnInstruction('Rechts auf Feldweg')).toBe('À droite sur chemin');
    expect(turnInstruction('Bring your own notes')).toBe(
      'Bring your own notes'
    );
    expect(i18n.t('import.success', { count: 1, name: 'Test' })).toContain(
      '1 case'
    );
    expect(i18n.t('import.success', { count: 2, name: 'Test' })).toContain(
      '2 cases'
    );
  });
  it('includes localized location permission strings in the macOS bundle', () => {
    const nativeRoot = new URL('../../../src-tauri/', import.meta.url);
    const config = JSON.parse(
      readFileSync(new URL('tauri.conf.json', nativeRoot), 'utf8')
    );
    for (const language of supportedLanguages) {
      const source =
        config.bundle.macOS.files[
          `Resources/${language}.lproj/InfoPlist.strings`
        ];
      expect(source).toBeTruthy();
      const strings = readFileSync(new URL(source, nativeRoot), 'utf8');
      expect(strings).toMatch(
        /"NSLocationWhenInUseUsageDescription" = "[^"\n]+";/
      );
      expect(strings).toMatch(/"NSLocationUsageDescription" = "[^"\n]+";/);
    }
  });
});
