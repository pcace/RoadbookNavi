import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { buildHelpSite } from './build-help.mjs';

test('public help contains the full guide without JavaScript and ships its assets', () => {
  const directory = mkdtempSync(join(tmpdir(), 'roadbook-help-test-'));
  try {
    buildHelpSite(directory);
    for (const language of ['de', 'en']) {
      const file = join(directory, language, 'index.html');
      const html = readFileSync(file, 'utf8');
      assert.ok(html.includes('<main id="help-article"'));
      assert.ok(
        html.includes(
          language === 'de'
            ? 'Von der Idee zum Roadbook'
            : 'From an idea to a roadbook'
        )
      );
      assert.ok(
        html.includes(
          language === 'de'
            ? 'Odometer einstellen'
            : 'Set and correct the odometer'
        )
      );
      assert.ok(html.includes('class="help-screenshot"'));
      const ids = new Set(
        [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
      );
      for (const match of html.matchAll(/href="#([^"]+)"/g))
        assert.ok(
          ids.has(decodeURIComponent(match[1])),
          'Broken chapter: ' + match[1]
        );
      for (const match of html.matchAll(/\bsrc="([^"]+)"/g))
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
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
