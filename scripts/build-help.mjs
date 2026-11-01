import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderHelpMarkdown } from '../src/ui/utils/helpMarkdown.ts';
import { languageOptions } from '../src/ui/i18n/languages.ts';

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
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');

export function buildHelpSite(destination) {
  mkdirSync(destination, { recursive: true });
  cpSync(join(root, 'public/help'), destination, { recursive: true });
  cpSync(
    join(root, 'src/ui/components/HelpContent.css'),
    join(destination, 'style.css')
  );
  cpSync(join(root, 'scripts/help-site.js'), join(destination, 'help.js'));
  for (const { code: language } of languageOptions) {
    // App and public help share the same interface translations.
    const { help: copy, buttons } = JSON.parse(
      readFileSync(
        join(root, 'src/ui/i18n/locales', language, 'common.json'),
        'utf8'
      )
    );
    const markdown = readFileSync(
      join(root, 'public/help', language + '.md'),
      'utf8'
    );
    for (const entry of [language, ...(language === 'en' ? [''] : [])]) {
      const prefix = entry ? '../' : './';
      const { html, chapters } = renderHelpMarkdown(markdown, prefix);
      const output = join(destination, entry);
      mkdirSync(output, { recursive: true });
      writeFileSync(
        join(output, 'index.html'),
        `<!doctype html>
<html lang="${language}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(copy.siteTitle)}</title>
<meta name="description" content="${escape(copy.siteDescription)}">
<link rel="canonical" href="https://roadbooknavi.de/help/${language}/">
${languageOptions.map(({ code }) => `<link rel="alternate" hreflang="${code}" href="https://roadbooknavi.de/help/${code}/">`).join('\n')}
<link rel="stylesheet" href="${prefix}style.css">
<link rel="icon" href="${prefix}../icon.png"></head>
<body class="help-document"><header class="help-site-header">
<a href="${prefix}../?lng=${language}">RoadbookNavi</a>
<nav aria-label="${escape(copy.siteNavigation)}">
<a href="${prefix}../app/?lng=${language}">${escape(copy.openApp)}</a>
${languageOptions.map(({ code, name }) => `<a href="${prefix}${code}/" lang="${code}" hreflang="${code}"${code === language ? ' aria-current="page"' : ''}>${escape(name)}</a>`).join('\n')}
</nav></header><div class="help-page">
<a class="help-skip" href="#help-article">${escape(copy.skip)}</a>
<div class="help-layout"><details class="help-sidebar" open><summary>${escape(copy.chapters)}</summary>
<div class="help-sidebar-content"><form hidden><label for="help-search">${escape(copy.searchLabel)}</label>
<input id="help-search" type="search" placeholder="${escape(copy.searchPlaceholder)}"></form>
<p class="help-search-status" role="status"></p><nav aria-label="${escape(copy.chapterNavigation)}">
${chapters.map(chapter => `<a href="#${escape(chapter.id)}">${escape(chapter.title)}</a>`).join('\n')}
</nav><a class="help-source" href="${prefix}${language}.md">${escape(copy.markdown)}</a></div></details>
<main id="help-article" class="help-article" tabindex="-1">${html}</main></div>
<dialog class="help-lightbox" aria-label="${escape(copy.fullSize)}">
<button class="help-lightbox-close">${escape(buttons.close)} ×</button><img alt=""><p></p></dialog></div>
<script id="help-chapters" type="application/json">${json(chapters)}</script>
<script id="help-copy" type="application/json">${json(copy)}</script>
<script type="module" src="${prefix}help.js"></script></body></html>
`
      );
    }
  }
}
