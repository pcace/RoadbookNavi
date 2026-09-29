import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';

const environment = {
  ...process.env,
  PATH: [join(homedir(), '.cargo', 'bin'), process.env.PATH]
    .filter(Boolean)
    .join(delimiter),
};

const androidSdk = [
  environment.ANDROID_HOME,
  environment.ANDROID_SDK_ROOT,
  join(homedir(), 'Library/Android/sdk'),
  join(homedir(), 'Android/Sdk'),
  environment.LOCALAPPDATA && join(environment.LOCALAPPDATA, 'Android/Sdk'),
].find(path => path && existsSync(join(path, 'platform-tools')));

if (androidSdk) {
  environment.ANDROID_HOME = androidSdk;
  environment.ANDROID_SDK_ROOT = androidSdk;
}

const installedTargets = spawnSync(
  'rustup',
  ['target', 'list', '--installed'],
  {
    env: environment,
    encoding: 'utf8',
  }
);
const canBuildAndroid =
  Boolean(androidSdk) &&
  existsSync(join(androidSdk, 'ndk')) &&
  readdirSync(join(androidSdk, 'ndk')).length > 0 &&
  installedTargets.stdout?.includes('aarch64-linux-android');

// A macOS application bundle can be launched directly. Building a decorated
// DMG is optional and can require interaction, so this command builds the app.
const commands = [
  [
    'Desktop',
    'desktop:build',
    ...(process.platform === 'darwin' ? ['--bundles', 'app'] : []),
  ],
  ...(canBuildAndroid
    ? [['Android ARM64 APK', 'android:build', '--apk', '--target', 'aarch64']]
    : []),
];

if (!canBuildAndroid) {
  console.log(
    'Skipping Android: the Android SDK, NDK, or aarch64 Rust target is missing.'
  );
}

let failed = false;
for (const [label, ...args] of commands) {
  console.log(`\nBuilding ${label}...`);
  const result = spawnSync(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    args,
    {
      cwd: new URL('..', import.meta.url),
      env: environment,
      stdio: 'inherit',
    }
  );

  if (result.error || result.status !== 0) {
    failed = true;
    console.error(`${label} build failed.`, result.error?.message ?? '');
  } else {
    console.log(`${label} build completed.`);
  }
}

process.exitCode = failed ? 1 : 0;
