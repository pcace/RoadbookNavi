import { afterEach, describe, expect, it } from 'vitest';
import { getErrorMessage, getGpsErrorMessage } from './errorMessage';
import i18n from '../i18n';

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('getErrorMessage', () => {
  it('renders the same GPS error in the current language after switching', async () => {
    const error = { code: 3, message: 'Timeout expired' };
    await i18n.changeLanguage('fr');
    expect(getGpsErrorMessage(error)).toBe(
      'Aucun signal GPS reçu dans le délai imparti.'
    );
    await i18n.changeLanguage('es');
    expect(getGpsErrorMessage(error)).toBe(
      'No se ha recibido señal GPS dentro del tiempo de espera.'
    );
    expect(
      getGpsErrorMessage({ code: 2, message: 'Standortzugriff nicht erlaubt' })
    ).toContain('Acceso a la ubicación no permitido');
  });
  it('preserves native Tauri command errors', () => {
    expect(getErrorMessage('Bundled Java runtime is missing', 'fallback')).toBe(
      'Bundled Java runtime is missing'
    );
  });

  it('supports JavaScript errors and a safe fallback', () => {
    expect(getErrorMessage(new Error('route failed'), 'fallback')).toBe(
      'route failed'
    );
    expect(getErrorMessage(null, 'fallback')).toBe('fallback');
  });

  it('translates core and native failures while retaining diagnostic paths', async () => {
    await i18n.changeLanguage('fr');
    expect(getErrorMessage(new Error('Ungültige Projektdatei'), '')).toBe(
      'Fichier de projet invalide'
    );
    expect(
      getErrorMessage(
        'Bundled Java runtime is missing: /engine/java Diagnostic file: /tmp/routing.log',
        ''
      )
    ).toBe(
      'L’environnement Java fourni est manquant: /engine/java Fichier de diagnostic: /tmp/routing.log'
    );
    await i18n.changeLanguage('es');
    expect(
      getErrorMessage(
        'Routingsegment E5_N50.rd5 wurde nicht vollständig geladen',
        ''
      )
    ).toContain('E5_N50.rd5 no se ha descargado');
    expect(getErrorMessage('geocoding.httpError:429', '')).toBe(
      'Búsqueda de lugares: HTTP 429.'
    );
    expect(getErrorMessage('unknown engine diagnostic', '')).toBe(
      'unknown engine diagnostic'
    );
  });
});
