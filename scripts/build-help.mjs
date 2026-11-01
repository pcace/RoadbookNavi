import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderHelpMarkdown } from '../src/ui/utils/helpMarkdown.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const escape = value =>
  value.replace(
    /[&<>"']/g,
    character =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]
  );

export function buildHelpSite(destination) {
  mkdirSync(destination, { recursive: true });
  cpSync(join(root, 'public/help'), destination, { recursive: true });
  cpSync(
    join(root, 'src/ui/components/HelpContent.css'),
    join(destination, 'style.css')
  );
  cpSync(join(root, 'scripts/help-site.js'), join(destination, 'help.js'));
  for (const language of ['de', 'en']) {
    const german = language === 'de';
    const markdown = readFileSync(
      join(root, 'public/help', language + '.md'),
      'utf8'
    );
    for (const entry of [language, ...(language === 'en' ? [''] : [])]) {
      const prefix = entry ? '../' : './';
      const { html, chapters } = renderHelpMarkdown(markdown, prefix);
      const title = german
        ? 'RoadbookNavi – Hilfe und Anleitung'
        : 'RoadbookNavi – Help and guide';
      const description = german
        ? 'Von der Idee zum Roadbook: planen, umbenennen, exportieren und navigieren. Schritt für Schritt mit aktuellen Screenshots.'
        : 'From an idea to a roadbook: plan, rename, export and navigate. Step-by-step instructions with current screenshots.';
      const output = join(destination, entry);
      mkdirSync(output, { recursive: true });
      writeFileSync(
        join(output, 'index.html'),
        '<!doctype html>\n' +
          [
            '<html lang="' + language + '"><head><meta charset="utf-8">',
            '<meta name="viewport" content="width=device-width, initial-scale=1">',
            '<title>' +
              title +
              '</title><meta name="description" content="' +
              description +
              '">',
            '<link rel="canonical" href="https://roadbooknavi.de/help/' +
              language +
              '/">',
            '<link rel="alternate" hreflang="de" href="https://roadbooknavi.de/help/de/">',
            '<link rel="alternate" hreflang="en" href="https://roadbooknavi.de/help/en/">',
            '<link rel="stylesheet" href="' + prefix + 'style.css">',
            '<link rel="icon" href="' + prefix + '../icon.png"></head>',
            '<body class="help-document"><header class="help-site-header">',
            '<a href="' +
              prefix +
              '../">RoadbookNavi</a><nav aria-label="' +
              (german ? 'Website und Sprache' : 'Website and language') +
              '">',
            '<a href="' +
              prefix +
              '../app/?lng=' +
              language +
              '">' +
              (german ? 'App öffnen' : 'Open app') +
              '</a>',
            '<a href="' +
              prefix +
              'de/" lang="de" hreflang="de"' +
              (german ? ' aria-current="page"' : '') +
              '>Deutsch</a>',
            '<a href="' +
              prefix +
              'en/" lang="en" hreflang="en"' +
              (!german ? ' aria-current="page"' : '') +
              '>English</a>',
            '</nav></header><div class="help-page">',
            '<a class="help-skip" href="#help-article">' +
              (german ? 'Zur Anleitung' : 'Skip to guide') +
              '</a>',
            '<div class="help-layout"><details class="help-sidebar" open><summary>' +
              (german ? 'Kapitel' : 'Chapters') +
              '</summary>',
            '<div class="help-sidebar-content"><form hidden><label for="help-search">' +
              (german ? 'Hilfe durchsuchen' : 'Search this guide') +
              '</label>',
            '<input id="help-search" type="search" placeholder="' +
              (german ? 'z. B. exportieren, GPS …' : 'e.g. export, GPS …') +
              '"></form>',
            '<p class="help-search-status" role="status"></p><nav aria-label="' +
              (german ? 'Hilfekapitel' : 'Help chapters') +
              '">',
            ...chapters.map(
              chapter =>
                '<a href="#' +
                escape(chapter.id) +
                '">' +
                escape(chapter.title) +
                '</a>'
            ),
            '</nav><a class="help-source" href="' +
              prefix +
              language +
              '.md">' +
              (german ? 'Anleitung als Markdown' : 'Read the Markdown file') +
              '</a></div></details>',
            '<main id="help-article" class="help-article" tabindex="-1">' +
              html +
              '</main></div>',
            '<dialog class="help-lightbox" aria-label="' +
              (german ? 'Screenshot in voller Größe' : 'Full-size screenshot') +
              '">',
            '<button class="help-lightbox-close">' +
              (german ? 'Schließen' : 'Close') +
              ' ×</button><img alt=""><p></p></dialog></div>',
            '<script id="help-chapters" type="application/json">' +
              JSON.stringify(chapters).replace(/</g, '\\u003c') +
              '</script>',
            '<script type="module" src="' +
              prefix +
              'help.js"></script></body></html>',
          ].join('\n')
      );
    }
  }
}
