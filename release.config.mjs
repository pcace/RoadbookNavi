const changelogTypes = [
  { type: 'feat', section: 'New features' },
  { type: 'fix', section: 'Bug fixes' },
  { type: 'perf', section: 'Performance improvements' },
  { type: 'refactor', section: 'Internal improvements', effect: 'changelog' },
  { type: 'docs', section: 'Documentation', effect: 'changelog' },
  { type: 'build', section: 'Build and dependencies', effect: 'changelog' },
  { type: 'ci', section: 'Build and dependencies', effect: 'changelog' },
  { type: 'test', section: 'Tests', effect: 'hidden' },
  { type: 'chore', section: 'Maintenance', effect: 'hidden' },
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
    '@semantic-release/github',
  ],
}
