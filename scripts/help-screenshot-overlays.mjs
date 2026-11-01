import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(
  readFileSync(root + 'Documentation/help-screenshots.json', 'utf8')
);
const sources = new Set(manifest.shots.map(shot => shot.source));
const { width, height } = manifest;

// Only the separate SVG layer adds arrows. The actual web captures stay intact.
createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1:1422');
  if (url.pathname.startsWith('/raw/')) {
    const name = url.pathname.slice(5).replace(/\.jpg$/, '');
    if (!sources.has(name)) {
      response.writeHead(404).end();
      return;
    }
    try {
      response.writeHead(200, { 'Content-Type': 'image/jpeg' });
      response.end(
        readFileSync(root + 'public/help/images/originals/' + name + '.jpg')
      );
    } catch {
      response.writeHead(404).end();
    }
    return;
  }
  const shot = manifest.shots.find(
    shot => shot.name === url.searchParams.get('shot')
  );
  if (!shot) {
    response.writeHead(404).end('Unknown screenshot');
    return;
  }
  const small = url.searchParams.get('size') === 'small';
  const crop = small ? shot.crop : [0, 0, width, height];
  const viewWidth = small ? Math.min(560, crop[2]) : width;
  const viewHeight = Math.round((viewWidth * crop[3]) / crop[2]);
  const arrows = shot.arrows
    .map((arrow, index) => {
      const [x1, y1] = arrow.start,
        [x2, y2] = arrow.end;
      return (
        '<g><path d="M' +
        x1 +
        ',' +
        y1 +
        ' L' +
        x2 +
        ',' +
        y2 +
        '" stroke="white" stroke-width="9" fill="none" stroke-linecap="round"/>' +
        '<path d="M' +
        x1 +
        ',' +
        y1 +
        ' L' +
        x2 +
        ',' +
        y2 +
        '" stroke="#dc5b06" stroke-width="5" fill="none" marker-end="url(#tip)"/>' +
        '<circle cx="' +
        x1 +
        '" cy="' +
        y1 +
        '" r="17" fill="#b74300" stroke="white" stroke-width="3"/>' +
        '<text x="' +
        x1 +
        '" y="' +
        (y1 + 6) +
        '" text-anchor="middle" font-family="system-ui,sans-serif" font-size="19" font-weight="800" fill="white">' +
        (index + 1) +
        '</text></g>'
      );
    })
    .join('');
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' +
    shot.name +
    ' — actual web screenshot with numbered arrows" width="' +
    viewWidth +
    '" height="' +
    viewHeight +
    '" viewBox="' +
    crop.join(' ') +
    '">' +
    '<defs><marker id="tip" viewBox="0 0 18 18" refX="15" refY="9" markerWidth="20" markerHeight="20" markerUnits="userSpaceOnUse" orient="auto"><path d="M2 2 L16 9 L2 16 Z" fill="#dc5b06" stroke="white" stroke-width="2"/></marker></defs>' +
    '<image href="/raw/' +
    shot.source +
    '.jpg" x="0" y="0" width="' +
    width +
    '" height="' +
    height +
    '"/>' +
    arrows +
    '</svg>';
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(
    '<!doctype html><html><head><meta charset="utf-8"><title>' +
      shot.name +
      '</title><style>html,body{margin:0;background:white}svg{display:block}</style></head><body>' +
      svg +
      '</body></html>'
  );
}).listen(1422, '127.0.0.1', () =>
  process.stdout.write(
    'Screenshot overlays: http://127.0.0.1:1422/?shot=odometer\n'
  )
);
