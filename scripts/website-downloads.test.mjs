// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { stableDownloads, applyDownloadLinks } from './website-downloads.mjs';

function release(version = '1.39.0', overrides = {}) {
  return {
    tag_name: `v${version}`,
    draft: false,
    prerelease: false,
    assets: [
      `RoadbookNavi-Windows-${version}-x64.exe`,
      `RoadbookNavi-macOS-${version}-arm64.dmg`,
      `RoadbookNavi-Linux-${version}-x86_64.AppImage`,
      `RoadbookNavi-Linux-${version}-amd64.deb`,
      `RoadbookNavi-Android-${version}-arm64.apk`,
    ].map(name => ({ name, state: 'uploaded' })),
    ...overrides,
  };
}

test('links directly to each installer in a complete stable release', () => {
  const downloads = stableDownloads([release()]);
  assert.equal(downloads.tag, 'v1.39.0');
  assert.equal(Object.keys(downloads.links).length, 5);
  assert.match(downloads.links.windows, /\/download\/v1\.39\.0\/.*-x64\.exe$/);
  assert.match(downloads.links.macos, /-arm64\.dmg$/);
  assert.match(downloads.links.linux, /-x86_64\.AppImage$/);
});

test('never selects beta releases, prereleases or drafts', () => {
  assert.equal(
    stableDownloads([
      release('2.0.0-beta.1'),
      release('2.0.0', { prerelease: true }),
      release('2.0.0', { draft: true }),
    ]),
    null
  );
});

test('keeps the previous stable installers while new packages are building', () => {
  const partial = release('1.40.0');
  partial.assets.pop();
  assert.equal(stableDownloads([partial, release()]).tag, 'v1.39.0');
  const uploading = release('1.40.0');
  uploading.assets[0].state = 'new';
  assert.equal(stableDownloads([uploading, release()]).tag, 'v1.39.0');
});

test('updates all real website download buttons without changing the online app', () => {
  const html = readFileSync(
    new URL('../docs/index.html', import.meta.url),
    'utf8'
  );
  const updated = applyDownloadLinks(
    html,
    stableDownloads([release('1.40.0')]).links
  );
  assert.equal((updated.match(/\/download\/v1\.40\.0\//g) || []).length, 5);
  assert.equal(updated.includes('/download/v1.39.0/'), false);
  assert.equal(updated.includes('href="app/"'), true);
});

test('rejects missing or duplicate download buttons instead of publishing broken links', () => {
  const html = readFileSync(
    new URL('../docs/index.html', import.meta.url),
    'utf8'
  );
  const links = stableDownloads([release()]).links;
  assert.throws(() => applyDownloadLinks('', links), /missing/);
  assert.throws(() => applyDownloadLinks(html + html, links), /Invalid/);
});
