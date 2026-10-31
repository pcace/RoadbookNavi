// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const output = resolve('output/desktop-pdf');
await mkdir(output, { recursive: true });
const isolated = await mkdtemp(join(tmpdir(), 'roadbook-desktop-pdf-'));
const dataHome = join(isolated, 'data');
const storage = join(dataHome, 'de.roadbooknavi.client');
await mkdir(storage, { recursive: true });
const results = [];

function project(count) {
  return {
    schemaVersion: 1,
    id: randomUUID(),
    name: `PDF test ${count}`,
    revision: 0,
    updatedAt: '2026-10-31T12:00:00Z',
    profile: 'trekking',
    waypoints: [],
    track: null,
    entries: Array.from({ length: count }, (_, index) => ({
      distance: index * 1000,
      note:
        index === count - 1
          ? 'FINISH - final complete entry'
          : 'Follow the road',
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200"><path d="M150 180V20M130 40L150 20L170 40" fill="none" stroke="black" stroke-width="4"/></svg>',
      turn: {
        id: `turn-${index}`,
        instruction: 'Straight ahead',
        angle: 0,
        bearing: 90,
        distanceFromStart: index * 1000,
        points: [
          {
            latitude: 52,
            longitude: 13,
            prevPoint: { latitude: 52, longitude: 13 },
            nextPoint: { latitude: 52, longitude: 13 },
            elevation: 0,
            distance: 1000,
            time: 0,
            wayTags: '',
            nodeTags: '',
            totalDistance: index * 1000,
          },
        ],
      },
    })),
  };
}
const scenarios = ['native', 'without-stream-iterator'].flatMap(mode =>
  [1, 40].map(count => ({ mode, count, project: project(count) }))
);
// Use the actual native project database, in an isolated test data directory.
execFileSync(
  'python3',
  [
    '-c',
    `
import sys,json,sqlite3
db=sqlite3.connect(sys.argv[1])
db.execute('CREATE TABLE projects(id TEXT PRIMARY KEY, body TEXT NOT NULL)')
for p in json.load(sys.stdin):
    db.execute('INSERT INTO projects VALUES(?,?)',(p['id'],json.dumps(p)))
db.commit()
`,
    join(storage, 'library.sqlite'),
  ],
  { input: JSON.stringify(scenarios.map(s => s.project)) }
);

let session;
async function request(
  path,
  body,
  method = body === undefined ? 'GET' : 'POST'
) {
  const response = await fetch(`http://127.0.0.1:4444${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const { value } = await response.json();
  if (!response.ok || value?.error) throw new Error(JSON.stringify(value));
  return value;
}
const execute = (fn, ...args) =>
  request(`/session/${session}/execute/sync`, {
    script: `return (${fn}).apply(null, arguments);`,
    args,
  });
const executeAsync = (fn, ...args) =>
  request(`/session/${session}/execute/async`, {
    script: `const done=arguments[arguments.length-1]; (${fn})(...Array.from(arguments).slice(0,-1)).then(done, error=>done({error:String(error)}));`,
    args,
  });
async function until(fn, label) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (await execute(fn)) return;
    await delay(250);
  }
  throw new Error(`Timed out: ${label}`);
}
async function screenshot(name) {
  const data = await request(`/session/${session}/screenshot`);
  await writeFile(join(output, name + '.png'), Buffer.from(data, 'base64'));
}
async function open(id, mode) {
  await execute(() => {
    location.hash = '/app/routes-list';
  });
  await request(`/session/${session}/refresh`, {});
  await until(
    () => document.querySelector('#root')?.children.length > 0,
    'app startup'
  );
  await execute(
    (id, mode) => {
      if (mode === 'without-stream-iterator') {
        Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, {
          configurable: true,
          value: undefined,
        });
      }
      location.hash = '/app/roadbook/' + id;
    },
    id,
    mode
  );
  await until(() => {
    if (document.body.innerText.includes('PDF konnte nicht geladen werden'))
      throw new Error(document.body.innerText);
    const canvas = document.querySelector('.roadbookPdfViewer canvas');
    return (
      canvas?.width > 0 &&
      canvas
        .getContext('2d')
        .getImageData(0, 0, canvas.width, Math.min(canvas.height, 400))
        .data.some((v, i) => i % 4 !== 3 && v < 100)
    );
  }, 'first PDF canvas');
}
async function cacheRecord(id) {
  return executeAsync(async id => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('RoadbookCache');
      request.onsuccess = () => resolve(request.result);
      request.onerror = reject;
    });
    return new Promise(resolve => {
      const request = db
        .transaction('roadbooks_pdf')
        .objectStore('roadbooks_pdf')
        .get(id);
      request.onsuccess = () => {
        db.close();
        resolve({
          cachedAt: request.result.cachedAt,
          bytes: request.result.pdfBytes.length,
        });
      };
    });
  }, id);
}
const driver = spawn('tauri-driver', [], {
  stdio: ['ignore', 'inherit', 'inherit'],
  env: {
    ...process.env,
    XDG_DATA_HOME: dataHome,
    XDG_CONFIG_HOME: join(isolated, 'config'),
    XDG_CACHE_HOME: join(isolated, 'cache'),
  },
});
try {
  await delay(1000);
  const created = await request('/session', {
    capabilities: {
      alwaysMatch: {
        browserName: 'wry',
        'tauri:options': {
          application: resolve('src-tauri/target/debug/roadbooknavi'),
        },
      },
    },
  });
  session = created.sessionId;
  await request(`/session/${session}/timeouts`, { script: 45000 });
  await execute(() => {
    localStorage.setItem(
      'roadbooknavi-geocoding',
      JSON.stringify({
        state: {
          enabled: false,
          base: 'https://nominatim.openstreetmap.org',
          key: '',
        },
        version: 1,
      })
    );
    localStorage.setItem(
      'roadbooknavi-settings',
      JSON.stringify({
        state: {
          interface: {
            language: 'en',
            colorMode: 'light',
            headerPosition: 'top',
          },
        },
        version: 0,
      })
    );
  });
  console.log('Desktop user agent:', await execute(() => navigator.userAgent));
  for (const scenario of scenarios) {
    const {
      mode,
      count,
      project: { id },
    } = scenario;
    await open(id, mode);
    await execute(() => {
      const root = document.querySelector('.roadbookPdfViewer');
      root.scrollTop = root.scrollHeight;
    });
    await until(
      () =>
        document.querySelector('[data-roadbook-page]:last-child canvas')
          ?.width > 0,
      'final PDF canvas'
    );
    await until(() => {
      const canvas = document.querySelector(
        '[data-roadbook-page]:last-child canvas'
      );
      return canvas
        .getContext('2d')
        .getImageData(0, 0, canvas.width, Math.min(canvas.height, 400))
        .data.some((v, i) => i % 4 !== 3 && v < 100);
    }, 'visible PDF content');
    const layout = await execute(() => {
      const root = document.querySelector('.roadbookPdfViewer');
      const pages = [...root.querySelectorAll('[data-roadbook-page]')];
      return {
        pages: pages.length,
        lastHeight: pages.at(-1).getBoundingClientRect().height,
        width: root.clientWidth,
      };
    });
    assert.equal(layout.pages, count === 1 ? 1 : 3);
    const contentHeight = count === 1 ? 351.85 : 201.85;
    assert.ok(
      Math.abs(layout.lastHeight - (layout.width * contentHeight) / 420) < 2,
      JSON.stringify(layout)
    );
    await screenshot(`${count}-${mode}`);
    const before = await cacheRecord(id);
    assert.ok(before.bytes > 1000);
    await open(id, mode);
    assert.deepEqual(
      await cacheRecord(id),
      before,
      'reopening must use the saved PDF'
    );
    results.push({ mode, entries: count, ...layout, cachedReopen: true });
    console.log('PASS', results.at(-1));
  }
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(results, null, 2)
  );
} catch (error) {
  if (session) {
    await screenshot('failure').catch(() => {});
    await writeFile(
      join(output, 'failure.txt'),
      await execute(() => document.body.innerText).catch(String)
    );
  }
  throw error;
} finally {
  if (session)
    await request(`/session/${session}`, undefined, 'DELETE').catch(() => {});
  driver.kill();
}
