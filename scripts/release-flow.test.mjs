// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import releaseConfig from '../release.config.mjs';
import { runRelease } from './release.mjs';

async function fixture(
  t,
  { branch = 'dev', message = 'feat: add browser routing' } = {}
) {
  const temp = await mkdtemp(join(tmpdir(), 'roadbooknavi-release-test-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const cwd = join(temp, 'work');
  const remote = join(temp, 'remote.git');
  const run = (...args) =>
    execFileSync('git', args, { encoding: 'utf8', stdio: 'pipe' }).trim();
  const git = (...args) => run('-C', cwd, ...args);
  const remoteGit = (...args) => run('--git-dir', remote, ...args);
  run('init', '--initial-branch=main', cwd);
  git('config', 'user.name', 'Release test');
  git('config', 'user.email', 'release-test@example.invalid');
  await mkdir(join(cwd, 'src-tauri'));
  await writeFile(join(cwd, '.gitignore'), '.semantic-release-output.json\n');
  await writeFile(
    join(cwd, 'package.json'),
    JSON.stringify({ name: 'roadbooknavi', version: '1.0.0', private: true })
  );
  await writeFile(
    join(cwd, 'src-tauri/tauri.conf.json'),
    JSON.stringify({ version: '1.0.0' })
  );
  await writeFile(
    join(cwd, 'src-tauri/Cargo.toml'),
    '[package]\nname = "roadbooknavi"\nversion = "1.0.0"\n'
  );
  await writeFile(
    join(cwd, 'src-tauri/Cargo.lock'),
    '[[package]]\nname = "roadbooknavi"\nversion = "1.0.0"\n'
  );
  await writeFile(
    join(cwd, 'CHANGELOG.md'),
    '# Changelog\n\nPrevious release.\n'
  );
  git('add', '.');
  git('commit', '-m', 'chore: initialize release fixture');
  git('tag', 'v1.0.0');
  git('branch', 'dev');
  git('checkout', branch);
  git('commit', '--allow-empty', '-m', message);
  run('clone', '--bare', cwd, remote);
  git('remote', 'add', 'origin', remote);
  git('fetch', 'origin');
  // Reproduce GitHub's update restriction: automation may not push main or dev.
  await writeFile(
    join(remote, 'hooks/pre-receive'),
    '#!/bin/sh\nwhile read old new ref; do\n case "$ref" in refs/heads/main|refs/heads/dev) echo "Cannot update this protected ref" >&2; exit 1;; esac\ndone\n',
    { mode: 0o755 }
  );

  const prs = [];
  const published = [];
  const output = join(cwd, '.semantic-release-output.json');
  const quiet = new Writable({
    write(chunk, encoding, callback) {
      callback();
    },
  });
  const github = {
    upsertPr: async value => {
      prs.push(value);
      return 'https://example.invalid/pull/1';
    },
    releaseExists: async tag =>
      published.some(release => release.gitTag === tag),
  };
  const release = () =>
    runRelease({
      cwd,
      branch,
      github,
      log() {},
      stdout: quiet,
      stderr: quiet,
      env: { ...process.env, CI: 'false', GITHUB_ACTIONS: '' },
      releaseOptions: {
        repositoryUrl: pathToFileURL(remote).href,
        ci: false,
        plugins: [
          ...releaseConfig.plugins.filter(plugin => Array.isArray(plugin)),
          {
            publish: (_, { nextRelease }) => {
              published.push(nextRelease);
              return { name: 'Local test release' };
            },
          },
        ],
      },
    });
  const merge = (method = 'merge') => {
    git('checkout', branch);
    if (method === 'squash') {
      git('merge', '--squash', `codex/release-${branch}`);
      git('commit', '-m', 'chore(release): merge version PR');
    } else {
      git(
        'merge',
        '--no-ff',
        `codex/release-${branch}`,
        '-m',
        'Merge version PR'
      );
    }
    // Simulate the human maintainer's allowed merge, outside the automation token.
    remoteGit('fetch', cwd, `HEAD:refs/heads/${branch}`);
  };
  return {
    cwd,
    git,
    remoteGit,
    prs,
    published,
    release,
    merge,
    output,
    branch,
  };
}

test('prepares a version PR without a release tag, branch update or installer output', async t => {
  const f = await fixture(t);
  const before = f.remoteGit('rev-parse', 'refs/heads/dev');
  const result = await f.release();
  assert.equal(result.kind, 'pull_request');
  assert.equal(result.version, '1.1.0-beta.1');
  assert.equal(f.remoteGit('rev-parse', 'refs/heads/dev'), before);
  assert.equal(f.remoteGit('tag', '--list', 'v1.1.0-beta.1'), '');
  assert.equal(f.prs[0].head, 'codex/release-dev');
  assert.equal(f.published.length, 0);
  assert.equal(
    JSON.parse(await readFile(join(f.cwd, 'package.json'))).version,
    result.version
  );
  await assert.rejects(readFile(f.output), { code: 'ENOENT' });
});

for (const branch of ['main', 'dev']) {
  test(`publishes ${branch} only after merging its version PR, including reruns`, async t => {
    const f = await fixture(t, { branch });
    const prepared = await f.release();
    f.merge();
    const approved = f.git('rev-parse', 'HEAD');
    const result = await f.release();
    assert.equal(result.kind, 'published');
    assert.equal(result.version, prepared.version);
    assert.equal(f.remoteGit('rev-parse', `refs/heads/${branch}`), approved);
    assert.equal(f.remoteGit('rev-parse', `refs/tags/${result.tag}`), approved);
    assert.equal(f.published.length, 1);
    assert.equal(f.published[0].channel, branch === 'dev' ? 'dev' : null);
    assert.deepEqual(JSON.parse(await readFile(f.output)), {
      version: result.version,
      tag: result.tag,
    });
    assert.equal((await f.release()).kind, 'published');
    assert.equal(f.published.length, 1);
    assert.equal(f.prs.length, 1);
  });
}

test('refreshes a stale version PR after other changes, without duplicate changelog entries', async t => {
  const f = await fixture(t);
  const first = await f.release();
  f.git('checkout', 'dev');
  f.git(
    'commit',
    '--allow-empty',
    '-m',
    'fix: include a later route correction'
  );
  f.remoteGit('fetch', f.cwd, 'HEAD:refs/heads/dev');
  f.merge();
  const updated = await f.release();
  assert.equal(updated.kind, 'pull_request');
  assert.equal(updated.version, first.version);
  assert.equal(f.published.length, 0);
  const changelog = await readFile(join(f.cwd, 'CHANGELOG.md'), 'utf8');
  assert.equal(changelog.split('add browser routing').length - 1, 1);
  assert.equal(
    changelog.split('include a later route correction').length - 1,
    1
  );
  assert.equal(changelog.split('Previous release.').length - 1, 1);
  await assert.rejects(readFile(f.output), { code: 'ENOENT' });
  f.merge();
  assert.equal((await f.release()).kind, 'published');
});

test('maintenance commits alone do not create a version PR', async t => {
  const f = await fixture(t, { message: 'docs: describe browser backups' });
  assert.equal((await f.release()).kind, 'none');
  assert.equal(f.prs.length, 0);
  assert.equal(f.published.length, 0);
});

test('a squash merge also approves the version PR', async t => {
  const f = await fixture(t);
  await f.release();
  f.merge('squash');
  assert.equal((await f.release()).kind, 'published');
  assert.equal(f.published.length, 1);
});
