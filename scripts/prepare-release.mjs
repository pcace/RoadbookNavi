import { readFile, writeFile } from 'node:fs/promises';
import { format } from 'prettier';

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
const manifestVersion = /(\[package\][\s\S]*?\nversion\s*=\s*")[^"]+("\s*\n)/;
if (!manifestVersion.test(cargoManifest)) {
  throw new Error('Could not update the RoadbookNavi version in Cargo.toml');
}
const updatedManifest = cargoManifest.replace(
  manifestVersion,
  `$1${version}$2`
);

await writeFile(cargoManifestPath, updatedManifest);

const cargoLockPath = 'src-tauri/Cargo.lock';
const cargoLock = await readFile(cargoLockPath, 'utf8');
const lockVersion =
  /(\[\[package\]\]\nname = "roadbooknavi"\nversion = ")[^"]+("\n)/;
if (!lockVersion.test(cargoLock)) {
  throw new Error('Could not update the RoadbookNavi version in Cargo.lock');
}
const updatedLock = cargoLock.replace(lockVersion, `$1${version}$2`);

await writeFile(cargoLockPath, updatedLock);

const changelogPath = 'CHANGELOG.md';
const changelog = await readFile(changelogPath, 'utf8');
await writeFile(changelogPath, await format(changelog, { parser: 'markdown' }));
