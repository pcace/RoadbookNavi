const changelogTypes = [
  { type: 'feat', section: 'New features' },
  { type: 'fix', section: 'Bug fixes' },
  { type: 'perf', section: 'Performance improvements' },
  { type: 'refactor', section: 'Internal improvements' },
  { type: 'docs', section: 'Documentation' },
  { type: 'build', section: 'Build and dependencies' },
  { type: 'ci', section: 'Build and dependencies' },
  { type: 'test', section: 'Tests', hidden: true },
  { type: 'chore', section: 'Maintenance', hidden: true },
]

export default {
  branches: ['main', { name: 'dev', prerelease: 'beta' }],
  tagFormat: 'v${version}',
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        releaseRules: [
          { type: 'perf', release: 'patch' },
          { type: 'refactor', release: false },
          { type: 'docs', release: false },
          { type: 'build', release: false },
          { type: 'ci', release: false },
          { type: 'test', release: false },
          { type: 'chore', release: false },
        ],
      },
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits',
        presetConfig: { types: changelogTypes },
      },
    ],
    '@semantic-release/changelog',
    [
      '@semantic-release/exec',
      {
        prepareCmd:
          'node scripts/prepare-release.mjs ${nextRelease.version} ${nextRelease.gitTag}',
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: [
          'CHANGELOG.md',
          'package.json',
          'src-tauri/tauri.conf.json',
          'src-tauri/Cargo.toml',
          'src-tauri/Cargo.lock',
        ],
        message:
          'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
    '@semantic-release/github',
  ],
}
