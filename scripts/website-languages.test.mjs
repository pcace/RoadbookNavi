// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const html = readFileSync(
  new URL('../docs/index.html', import.meta.url),
  'utf8'
);
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function website({
  language,
  saved,
  browserLanguages = ['en'],
  storageBlocked = false,
} = {}) {
  const elements = [
    ...html.matchAll(/data-text="([^"]+)"(?:\s+data-attribute="([^"]+)")?/g),
  ].map(([, key, attribute]) => ({
    dataset: { text: key, attribute },
    setAttribute(key, value) {
      this[key] = value;
    },
  }));
  const buttons = ['de', 'en', 'es', 'fr'].map(language => ({
    dataset: { language },
    classList: { toggle() {} },
    setAttribute(key, value) {
      this[key] = value;
    },
    addEventListener(event, handler) {
      this.click = handler;
    },
  }));
  const onlineLink = {};
  const document = {
    documentElement: {},
    querySelector(selector) {
      return selector.startsWith('meta') ? {} : onlineLink;
    },
    querySelectorAll(selector) {
      return selector === '[data-text]'
        ? elements
        : selector === '[data-language]'
          ? buttons
          : [];
    },
  };
  let stored = saved;
  const href = `http://localhost/${language ? `?lng=${language}` : ''}`;
  const context = {
    document,
    URL,
    URLSearchParams,
    location: { hostname: 'localhost', href, search: new URL(href).search },
    history: { replaceState() {} },
    navigator: { languages: browserLanguages },
    localStorage: {
      getItem() {
        if (storageBlocked) throw new Error('blocked');
        return stored;
      },
      setItem(key, value) {
        if (storageBlocked) throw new Error('blocked');
        stored = value;
      },
    },
  };
  runInNewContext(script, context);
  return { document, buttons, elements, onlineLink, stored: () => stored };
}

test('every website field and accessible label is translated in all four languages', () => {
  for (const language of ['de', 'en', 'es', 'fr']) {
    const site = website({ language });
    assert.equal(site.document.documentElement.lang, language);
    assert.equal(site.onlineLink.href, `app/?lng=${language}`);
    for (const element of site.elements) {
      assert.equal(
        typeof element[element.dataset.attribute || 'textContent'],
        'string',
        `${language}: ${element.dataset.text}`
      );
      assert.ok(element[element.dataset.attribute || 'textContent'].trim());
    }
    assert.equal(
      site.buttons.find(button => button.dataset.language === language)[
        'aria-pressed'
      ],
      'true'
    );
  }
});

test('explicit links override saved choices and regional browser languages are supported', () => {
  assert.equal(
    website({ language: 'fr-CA', saved: 'de' }).document.documentElement.lang,
    'fr'
  );
  assert.equal(
    website({ browserLanguages: ['it-IT', 'es-MX'] }).document.documentElement
      .lang,
    'es'
  );
  assert.equal(
    website({ language: 'unsupported' }).document.documentElement.lang,
    'en'
  );
});

test('changing language updates website content, app links and persistence', () => {
  const site = website({ language: 'en' });
  site.buttons.find(button => button.dataset.language === 'es').click();
  assert.equal(site.document.documentElement.lang, 'es');
  assert.equal(
    site.elements.find(element => element.dataset.text === 'downloadWindows')
      .textContent,
    'Descargar para Windows'
  );
  assert.equal(site.onlineLink.href, 'app/?lng=es');
  assert.equal(site.stored(), 'es');
});

test('website translation still works when browser storage is disabled', () => {
  const site = website({ language: 'fr', storageBlocked: true });
  assert.equal(site.document.documentElement.lang, 'fr');
  assert.equal(site.onlineLink.href, 'app/?lng=fr');
});
