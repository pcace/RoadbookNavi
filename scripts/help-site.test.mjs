import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { buildHelpSite } from './build-help.mjs';

function checkLanguageLinks(html, file) {
  const links = [
    ...html.matchAll(/<a\b[^>]*data-help-language="([^"]+)"[^>]*>/g),
  ];
  assert.equal(links.length, 3, 'All three translated guides are linked');
  for (const [tag, language] of links) {
    const href = tag.match(/href="([^"]+)"/)[1];
    assert.ok(href.endsWith('/' + language + '/'));
    assert.ok(
      existsSync(resolve(dirname(file), href, 'index.html')),
      'Missing formatted translation: ' + href
    );
  }
}

test('public help contains the full guide without JavaScript and ships its assets', () => {
  const directory = mkdtempSync(join(tmpdir(), 'roadbook-help-test-'));
  try {
    buildHelpSite(directory);
    for (const language of ['de', 'en', 'es', 'fr']) {
      const file = join(directory, language, 'index.html');
      const html = readFileSync(file, 'utf8');
      checkLanguageLinks(html, file);
      assert.ok(html.includes('<main id="help-article"'));
      const headings = {
        de: ['Von der Idee zum Roadbook', 'Odometer einstellen'],
        en: ['From an idea to a roadbook', 'Set and correct the odometer'],
        es: [
          'De una idea a un roadbook',
          'Ajustar y corregir el cuentakilómetros',
        ],
        fr: ['De l’idée au roadbook', 'Régler et corriger le compteur'],
      };
      for (const heading of headings[language])
        assert.ok(html.includes(heading));
      assert.ok(html.includes('<html lang="' + language + '">'));
      assert.ok(html.includes('app/?lng=' + language));
      for (const alternate of ['de', 'en', 'es', 'fr']) {
        assert.ok(html.includes('hreflang="' + alternate + '"'));
        assert.ok(html.includes('href="../' + alternate + '/"'));
        assert.ok(existsSync(join(directory, alternate + '.md')));
      }
      const copy = JSON.parse(
        html.match(
          /<script id="help-copy" type="application\/json">(.*?)<\/script>/s
        )[1]
      );
      assert.ok(copy.searchLabel);
      assert.ok(copy.matches_one.includes('{{count}}'));
      assert.ok(copy.matches_other.includes('{{count}}'));
      assert.ok(html.includes('class="help-screenshot"'));
      const ids = new Set(
        [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
      );
      for (const match of html.matchAll(/href="#([^"]+)"/g))
        assert.ok(
          ids.has(decodeURIComponent(match[1])),
          'Broken chapter: ' + match[1]
        );
      for (const match of html.matchAll(
        /\b(?:src|href)="((?:\.\.?\/)[^"?#]+)"/g
      ))
        if (!match[1].startsWith('../..'))
          assert.ok(
            existsSync(resolve(dirname(file), match[1])),
            'Missing asset: ' + match[1]
          );
    }
    assert.ok(
      readFileSync(join(directory, 'index.html'), 'utf8').includes(
        'Using RoadbookNavi'
      )
    );
    assert.ok(existsSync(join(directory, 'de.md')));
    assert.ok(existsSync(join(directory, 'en.md')));
    checkLanguageLinks(
      readFileSync(join(directory, 'index.html'), 'utf8'),
      join(directory, 'index.html')
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
