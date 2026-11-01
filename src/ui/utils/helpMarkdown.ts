import MarkdownIt from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';

export interface HelpChapter {
  id: string;
  title: string;
  text: string;
}

// Match GitHub's fragment names so the source also works as a handbook there.
export const helpSlug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_\s-]/gu, '')
    .replace(/\s/g, '-');

export function renderHelpMarkdown(markdown: string, assetBase: string) {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
  }).use(markdownItAnchor, { level: [2, 3], slugify: helpSlug });
  const image = md.renderer.rules.image!;
  md.renderer.rules.image = (tokens, index, options, env, self) => {
    const token = tokens[index];
    const src = String(token.attrGet('src') || '');
    if (src.startsWith('images/')) token.attrSet('src', `${assetBase}${src}`);
    token.attrSet('loading', 'lazy');
    token.attrSet('decoding', 'async');
    return image(tokens, index, options, env, self);
  };
  md.renderer.rules.link_open = (tokens, index, options, _env, self) => {
    const token = tokens[index];
    const href = String(token.attrGet('href') || '');
    if (href.startsWith('images/')) {
      token.attrSet('href', `${assetBase}${href}`);
      token.attrSet('class', 'help-screenshot');
    }
    if (/^(de|en)\.md$/.test(href)) token.attrSet('href', assetBase + href);
    return self.renderToken(tokens, index, options);
  };
  const tokens = md.parse(markdown, {});
  const chapters: HelpChapter[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'heading_open' && token.tag === 'h2') {
      chapters.push({
        id: String(token.attrGet('id')),
        title: tokens[i + 1].content,
        text: '',
      });
    }
    if (token.type === 'inline' && chapters.length)
      chapters[chapters.length - 1].text += ` ${token.content}`;
  }
  return { html: md.renderer.render(tokens, md.options, {}), chapters };
}
