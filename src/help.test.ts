import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderHelpMarkdown } from './ui/utils/helpMarkdown';

describe('portable user handbook', () => {
  for (const language of ['de', 'en', 'es', 'fr']) {
    it(language + ': all chapter links and local pictures resolve', () => {
      const source = readFileSync(
        new URL('../public/help/' + language + '.md', import.meta.url),
        'utf8'
      );
      const { html, chapters } = renderHelpMarkdown(source, '/app/help/');
      const ids = new Set(
        [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
      );
      expect(chapters.length).toBeGreaterThan(20);
      for (const match of html.matchAll(/href="#([^"]+)"/g))
        expect(ids.has(decodeURIComponent(match[1])), match[1]).toBe(true);
      const pictures = [...source.matchAll(/\]\((images\/[^)]+)\)/g)].map(
        match => match[1]
      );
      expect(new Set(pictures).size).toBeGreaterThan(30);
      for (const path of pictures) {
        const file = new URL('../public/help/' + path, import.meta.url);
        expect(existsSync(file), path).toBe(true);
        const bytes = readFileSync(file);
        expect([...bytes.subarray(0, 3)], path).toEqual([255, 216, 255]);
      }
      expect(html).not.toContain('/help/img/small/');
      expect(html).toContain('class="help-screenshot"');
      expect(html).toContain('loading="lazy"');
      const english = readFileSync(
        new URL('../public/help/en.md', import.meta.url),
        'utf8'
      );
      expect(pictures).toEqual(
        [...english.matchAll(/\]\((images\/[^)]+)\)/g)].map(match => match[1])
      );
      expect(chapters).toHaveLength(
        renderHelpMarkdown(english, '/app/help/').chapters.length
      );
    });
  }

  it('keeps Unicode chapter fragments and picture URLs usable in app and static help', () => {
    const markdown =
      '## Roadbook löschen\n\n[Go](#roadbook-löschen)\n\n[![Remove](images/a-small.jpg)](images/a.jpg)\n\n[English](en.md)';
    const app = renderHelpMarkdown(
      markdown,
      '/app/help/',
      language => `?lng=${language}#/app/help`
    );
    const site = renderHelpMarkdown(markdown, '../');
    expect(app.chapters[0].id).toBe('roadbook-löschen');
    expect(app.html).toContain('href="/app/help/images/a.jpg"');
    expect(app.html).toContain('src="/app/help/images/a-small.jpg"');
    expect(app.html).toContain('href="?lng=en#/app/help"');
    expect(site.html).toContain('href="../images/a.jpg"');
    expect(site.html).toContain('href="../en/"');
  });

  it('opens formatted translations while keeping source Markdown links portable', () => {
    for (const language of ['de', 'en', 'es', 'fr']) {
      const markdown = `[Guide](${language}.md)`;
      for (const prefix of ['../', './']) {
        const { html } = renderHelpMarkdown(markdown, prefix);
        expect(html).toContain(`href="${prefix}${language}/"`);
        expect(html).toContain(`data-help-language="${language}"`);
        expect(html).not.toContain('.md');
      }
      const app = renderHelpMarkdown(
        markdown,
        '/app/help/',
        language => `?lng=${language}#/app/help`
      );
      expect(app.html).toContain(`href="?lng=${language}#/app/help"`);
      expect(app.html).toContain(`data-help-language="${language}"`);
      expect(app.html).not.toContain('.md');
    }
  });
});
