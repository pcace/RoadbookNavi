import { readFile, writeFile } from 'node:fs/promises';

const [version, tag] = process.argv.slice(2);

if (!version || !tag) {
  throw new Error('Expected a release version and Git tag');
}

async function updateJson(path, update) {
  const value = JSON.parse(await readFile(path, 'utf8'));
  update(value);
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

await updateJson('package.json', value => {
  value.version = version;
});

await updateJson('src-tauri/tauri.conf.json', value => {
  value.version = version;
});

const cargoManifestPath = 'src-tauri/Cargo.toml';
const cargoManifest = await readFile(cargoManifestPath, 'utf8');
const updatedManifest = cargoManifest.replace(
  /(\[package\][\s\S]*?\nversion\s*=\s*")[^"]+("\s*\n)/,
  `$1${version}$2`
);

if (updatedManifest === cargoManifest) {
  throw new Error('Could not update the RoadbookNavi version in Cargo.toml');
}

await writeFile(cargoManifestPath, updatedManifest);

const cargoLockPath = 'src-tauri/Cargo.lock';
const cargoLock = await readFile(cargoLockPath, 'utf8');
const updatedLock = cargoLock.replace(
  /(\[\[package\]\]\nname = "roadbooknavi"\nversion = ")[^"]+("\n)/,
  `$1${version}$2`
);

if (updatedLock === cargoLock) {
  throw new Error('Could not update the RoadbookNavi version in Cargo.lock');
}

await writeFile(cargoLockPath, updatedLock);
await writeFile(
  '.semantic-release-output.json',
  `${JSON.stringify({ version, tag })}\n`
);
