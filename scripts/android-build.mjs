import { execFileSync, spawnSync } from 'node:child_process';
import { delimiter, join } from 'node:path';
import { homedir } from 'node:os';

const env = {
  ...process.env,
  PATH: [join(homedir(), '.cargo', 'bin'), process.env.PATH]
    .filter(Boolean)
    .join(delimiter),
  // Tauri mobile plugin build scripts generate files in their shared Cargo
  // source directories. Serial compilation prevents two plugin instances from
  // creating the same directory at once on clean CI runners.
  CARGO_BUILD_JOBS: process.env.CARGO_BUILD_JOBS || '1',
};

if (process.platform === 'darwin') {
  env.JAVA_HOME = execFileSync('/usr/libexec/java_home', ['-v', '17'], {
    encoding: 'utf8',
  }).trim();
}

const tauri = process.platform === 'win32' ? 'tauri.cmd' : 'tauri';
const result = spawnSync(
  tauri,
  ['android', 'build', ...process.argv.slice(2)],
  { env, stdio: 'inherit' }
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
