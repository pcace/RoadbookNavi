import type { Rn2Document, Rn2Element } from './core/rn2/document';
import { fiaSymbolName } from './fia-symbols';
const files = import.meta.glob<string>(
  '../assets/fia-symbols/svg/glyphs/*.svg',
  { query: '?raw', import: 'default' }
);
const glyphs = Object.fromEntries(
  Object.entries(files).map(([path, load]) => [
    path
      .split('/')
      .at(-1)!
      .replace(/\.svg$/, ''),
    load,
  ])
);
type Asset = { body: string; width: number; height: number };
const cache = new Map<string, Promise<Asset | undefined>>();
const finite = (n: any, fallback: number) =>
  typeof n === 'number' && Number.isFinite(n) ? n : fallback;
async function loadGlyph(name: string): Promise<Asset | undefined> {
  const doc = new DOMParser().parseFromString(
      await glyphs[name](),
      'image/svg+xml'
    ),
    root = doc.documentElement;
  if (root.localName !== 'svg') return;
  // Preserve Illustrator class colours before safeSvg strips stylesheets.
  for (const style of Array.from(root.querySelectorAll('style'))) {
    for (const rule of (style.textContent || '').matchAll(
      /([^{}]+)\{([^{}]*)\}/g
    )) {
      for (const selector of rule[1].split(',').map(s => s.trim())) {
        if (!/^(\.[\w-]+|#[\w-]+|[a-z]+)$/.test(selector)) continue;
        for (const el of Array.from(root.querySelectorAll(selector)))
          el.setAttribute(
            'style',
            rule[2] + ';' + (el.getAttribute('style') || '')
          );
      }
    }
    style.remove();
  }
  const prefix = 'fia-' + name.replace(/\W/g, '-') + '-';
  for (const el of Array.from(root.querySelectorAll('[id]')))
    el.id = prefix + el.id;
  for (const el of [root, ...Array.from(root.querySelectorAll('*'))])
    for (const attr of Array.from(el.attributes)) {
      if (attr.name !== 'id')
        el.setAttribute(
          attr.name,
          attr.value.replace(
            /url\(#([\w-]+)\)/g,
            (_, id) => `url(#${prefix}${id})`
          )
        );
    }
  const box = (root.getAttribute('viewBox') || '')
    .trim()
    .split(/[ ,]+/)
    .map(Number);
  const width = box[2] || parseFloat(root.getAttribute('width') || '') || 250,
    height = box[3] || parseFloat(root.getAttribute('height') || '') || 250;
  // Tulip crops some signs (notably !!) tightly. RN positions assume an icon
  // box, so fit the replacement inside a square instead of growing into notes.
  const size = Math.max(width, height);
  root.setAttribute('x', '0');
  root.setAttribute('y', '0');
  root.setAttribute('width', String(size));
  root.setAttribute('height', String(size));
  root.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  return {
    body: new XMLSerializer().serializeToString(root),
    width: size,
    height: size,
  };
}
export async function rn2IconResolver(doc: Rn2Document) {
  const assets = new Map<string, Asset>();
  const key = (e: Rn2Element) => JSON.stringify([e.src, e.name]);
  const elements = doc.route.waypoints.flatMap(w => [
    ...(w.tulip?.elements || []),
    ...(w.notes?.elements || []),
  ]);
  for (const e of elements) {
    if (e.type !== 'Icon' || assets.has(key(e))) continue;
    const name = fiaSymbolName(String(e.name || ''), Object.keys(glyphs));
    if (name) {
      if (!cache.has(name))
        cache.set(
          name,
          loadGlyph(name).catch(() => undefined)
        );
      const asset = await cache.get(name);
      if (asset) assets.set(key(e), asset);
    } else if (
      typeof e.src === 'string' &&
      e.src.length < 2_000_000 &&
      /^data:image\/(png|jpeg);base64,[a-z\d+/=]+$/i.test(e.src)
    ) {
      const img = new Image();
      img.src = e.src;
      try {
        await img.decode();
        assets.set(key(e), {
          body: `<image href="${e.src}" width="${img.naturalWidth}" height="${img.naturalHeight}"/>`,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      } catch {
        /* invalid embedded image -> placeholder */
      }
    }
  }
  return (e: Rn2Element) => {
    const asset = assets.get(key(e));
    if (!asset) return;
    const baseWidth = finite(e.width, asset.width),
      baseHeight = finite(e.height, asset.height);
    const sx = finite(e.scaleX, finite(e.w, baseWidth) / baseWidth),
      sy = finite(e.scaleY, sx);
    const width = baseWidth * sx,
      height = baseHeight * sy;
    return `<g transform="translate(${finite(e.x, 99.5)} ${finite(e.y, 67.5)}) rotate(${finite(e.angle, 0)})"><g transform="translate(${-width / 2} ${-height / 2}) scale(${width / asset.width} ${height / asset.height})">${asset.body}</g></g>`;
  };
}
