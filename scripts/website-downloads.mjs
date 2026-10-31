// SPDX-License-Identifier: GPL-3.0-only
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = 'pcace/RoadbookNavi';
const filenames = {
  windows: version => `RoadbookNavi-Windows-${version}-x64.exe`,
  macos: version => `RoadbookNavi-macOS-${version}-arm64.dmg`,
  linux: version => `RoadbookNavi-Linux-${version}-x86_64.AppImage`,
  'linux-deb': version => `RoadbookNavi-Linux-${version}-amd64.deb`,
  android: version => `RoadbookNavi-Android-${version}-arm64.apk`,
};

export function stableDownloads(releases) {
  for (const release of releases) {
    if (
      release.draft ||
      release.prerelease ||
      !/^v\d+\.\d+\.\d+$/.test(release.tag_name)
    )
      continue;
    const version = release.tag_name.slice(1);
    const links = {};
    for (const [platform, filename] of Object.entries(filenames)) {
      const name = filename(version);
      if (
        release.assets?.some(
          asset => asset.name === name && asset.state === 'uploaded'
        )
      )
        links[platform] =
          `https://github.com/${repository}/releases/download/${release.tag_name}/${name}`;
    }
    if (Object.keys(links).length === Object.keys(filenames).length)
      return { tag: release.tag_name, links };
  }
  return null;
}

export function applyDownloadLinks(html, links) {
  const updated = new Set();
  const result = html.replace(
    /(data-download="([a-z-]+)"\s+href=")[^"]+(")/g,
    (match, prefix, platform, suffix) => {
      if (!links[platform] || updated.has(platform))
        throw new Error(`Invalid download link: ${platform}`);
      updated.add(platform);
      return prefix + links[platform] + suffix;
    }
  );
  if (updated.size !== Object.keys(filenames).length)
    throw new Error('The website is missing a platform download link.');
  return result;
}

async function releaseMetadata(path) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (process.env.GH_TOKEN)
    headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
  const response = await fetch(
    `https://api.github.com/repos/${repository}/${path}`,
    { headers, signal: AbortSignal.timeout(15000) }
  );
  if (!response.ok)
    throw new Error(`Cannot load release metadata: HTTP ${response.status}`);
  return response.json();
}

async function updateWebsite(directory) {
  let downloads = stableDownloads([await releaseMetadata('releases/latest')]);
  downloads ??= stableDownloads(await releaseMetadata('releases?per_page=100'));
  if (!downloads)
    throw new Error('No stable release has all published installers.');
  const path = resolve(directory, 'index.html');
  await writeFile(
    path,
    applyDownloadLinks(await readFile(path, 'utf8'), downloads.links)
  );
  console.log(
    `Website downloads use published installers from ${downloads.tag}.`
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await updateWebsite(process.argv[2] || 'dist-web');
