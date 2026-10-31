import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = new URL('../dist-web/', import.meta.url);
rmSync(output, { recursive: true, force: true });
mkdirSync(output);
cpSync(new URL('../docs/', import.meta.url), output, { recursive: true });
execFileSync('pnpm', ['exec', 'tsc', '--noEmit'], {
  cwd: root,
  stdio: 'inherit',
});
execFileSync(
  'pnpm',
  ['exec', 'vite', 'build', '--base=/app/', '--outDir=dist-web/app'],
  {
    cwd: root,
    stdio: 'inherit',
  }
);
