import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { analyzeCommits } from '@semantic-release/commit-analyzer';
import { generateNotes } from '@semantic-release/release-notes-generator';
import releaseConfig from '../release.config.mjs';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const pluginConfig = name =>
  releaseConfig.plugins.find(
    plugin => Array.isArray(plugin) && plugin[0] === name
  )[1];
const analyzer = pluginConfig('@semantic-release/commit-analyzer');
const generator = pluginConfig('@semantic-release/release-notes-generator');
const commits = messages =>
  messages.map((message, index) => ({
    message,
    hash: String(index + 1).padStart(40, '0'),
  }));
const context = messages => ({
  cwd,
  commits: commits(messages),
  logger: { log() {} },
  options: { repositoryUrl: 'https://github.com/pcace/RoadbookNavi.git' },
  lastRelease: { version: '1.39.0-beta.6', gitTag: 'v1.39.0-beta.6' },
  nextRelease: { version: '1.39.0-beta.7', gitTag: 'v1.39.0-beta.7' },
});

test('renders release notes with the installed preset and configured sections', async () => {
  const notes = await generateNotes(
    generator,
    context([
      'feat: add browser routing (#61)',
      'fix: restore native rendering',
      'perf: render long roadbooks incrementally',
      'refactor: simplify route storage',
      'docs: explain browser backups',
      'build: update release tooling',
      'ci: check release notes before merging',
      'test: hidden test maintenance',
      'chore: hidden dependency maintenance',
    ])
  );

  for (const section of [
    'New features',
    'Bug fixes',
    'Performance improvements',
    'Internal improvements',
    'Documentation',
    'Build and dependencies',
  ]) {
    assert.ok(notes.includes(`### ${section}`), `Missing section: ${section}`);
  }
  assert.ok(notes.includes('add browser routing'));
  assert.ok(notes.includes('https://github.com/pcace/RoadbookNavi/issues/61'));
  assert.ok(notes.includes('/compare/v1.39.0-beta.6...v1.39.0-beta.7'));
  assert.ok(!notes.includes('hidden test maintenance'));
  assert.ok(!notes.includes('hidden dependency maintenance'));
});

test('keeps the documented release triggers after toolchain updates', async () => {
  for (const [message, expected] of [
    ['feat: add browser routing', 'minor'],
    ['fix: restore native rendering', 'patch'],
    ['perf: render long roadbooks incrementally', 'patch'],
    ['feat!: change the project format', 'major'],
    [
      'fix: change the project format\n\nBREAKING CHANGE: migrate saved projects',
      'major',
    ],
    ['refactor: simplify route storage', null],
    ['docs: explain browser backups', null],
    ['build: update release tooling', null],
    ['ci: check release notes before merging', null],
    ['test: extend coverage', null],
    ['chore: update dependencies', null],
  ]) {
    assert.equal(
      await analyzeCommits(analyzer, context([message])),
      expected,
      message
    );
  }
});

test('includes breaking change details in release notes', async () => {
  const notes = await generateNotes(
    generator,
    context([
      'feat!: change the project format\n\nBREAKING CHANGE: migrate saved projects',
    ])
  );
  assert.ok(notes.includes('BREAKING CHANGES'));
  assert.ok(notes.includes('migrate saved projects'));
});
