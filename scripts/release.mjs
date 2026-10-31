// SPDX-License-Identifier: GPL-3.0-only
import { execFile } from 'node:child_process';
import { readFile, writeFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import semanticRelease from 'semantic-release';
import { prepare as prepareChangelog } from '@semantic-release/changelog';
import releaseConfig from '../release.config.mjs';

const exec = promisify(execFile);
const planFile = 'release-plan.json';
const outputFile = '.semantic-release-output.json';
const assets = [
  'CHANGELOG.md',
  'package.json',
  'src-tauri/tauri.conf.json',
  'src-tauri/Cargo.toml',
  'src-tauri/Cargo.lock',
  planFile,
];
const prepareScript = fileURLToPath(
  new URL('./prepare-release.mjs', import.meta.url)
);

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function githubClient(repository, options) {
  const gh = async args =>
    (await exec('gh', [...args, '--repo', repository], options)).stdout;
  return {
    async releaseExists(tag) {
      try {
        await gh(['release', 'view', tag]);
        return true;
      } catch (error) {
        if (/release not found/i.test(error.stderr)) return false;
        throw error;
      }
    },
    async upsertPr({ branch, head, version, notes }) {
      const prs = JSON.parse(
        await gh([
          'pr',
          'list',
          '--base',
          branch,
          '--head',
          head,
          '--state',
          'open',
          '--json',
          'number',
        ])
      );
      const temp = await mkdtemp(join(tmpdir(), 'roadbooknavi-release-pr-'));
      try {
        const body = join(temp, 'body.md');
        await writeFile(
          body,
          `Release ${version} from \`${branch}\`.\n\nMerge this version PR after reviewing its CI. The release and installer builds start after your merge. New changes on the target branch update this PR before publication.\n\n${notes}\n`
        );
        const title = `chore(release): ${version}`;
        if (prs.length) {
          await gh([
            'pr',
            'edit',
            String(prs[0].number),
            '--title',
            title,
            '--body-file',
            body,
          ]);
          return (
            await gh([
              'pr',
              'view',
              String(prs[0].number),
              '--json',
              'url',
              '--jq',
              '.url',
            ])
          ).trim();
        }
        return (
          await gh([
            'pr',
            'create',
            '--base',
            branch,
            '--head',
            head,
            '--title',
            title,
            '--body-file',
            body,
          ])
        ).trim();
      } finally {
        await rm(temp, { recursive: true, force: true });
      }
    },
  };
}

export async function runRelease({
  cwd = process.cwd(),
  env = process.env,
  branch = env.GITHUB_REF_NAME,
  github,
  releaseOptions = {},
  stdout = process.stdout,
  stderr = process.stderr,
  log = console.log,
} = {}) {
  const options = { cwd, env };
  const git = async (...args) =>
    (await exec('git', args, options)).stdout.trim();
  branch ||= await git('branch', '--show-current');
  if (!['main', 'dev'].includes(branch))
    throw new Error(`Unsupported release branch: ${branch}`);
  if (!github && !env.GITHUB_REPOSITORY)
    throw new Error('GITHUB_REPOSITORY is required');
  github ||= githubClient(env.GITHUB_REPOSITORY, options);
  await rm(join(cwd, outputFile), { force: true });

  const coreOptions = { ...releaseConfig, ...releaseOptions };
  const analysisPlugins = releaseConfig.plugins.filter(plugin =>
    Array.isArray(plugin)
  );
  const context = { cwd, env, stdout, stderr };
  const result = await semanticRelease(
    { ...coreOptions, plugins: analysisPlugins, dryRun: true },
    context
  );
  const plan = await readJson(join(cwd, planFile));
  const head = await git('rev-parse', 'HEAD');

  const reportRelease = async value => {
    await writeFile(
      join(cwd, outputFile),
      `${JSON.stringify({ version: value.version, tag: value.tag })}\n`
    );
    log(`Published release ${value.tag}; installer builds can start.`);
    return { kind: 'published', version: value.version, tag: value.tag };
  };

  if (!result?.nextRelease) {
    // A rerun after publication must still let the installer jobs resume.
    if (
      plan?.branch === branch &&
      (await git('tag', '--points-at', head)).split('\n').includes(plan.tag) &&
      (await github.releaseExists(plan.tag))
    ) {
      return reportRelease(plan);
    }
    log('No releasable changes.');
    return { kind: 'none' };
  }

  const { nextRelease } = result;
  const parent = await git('rev-parse', 'HEAD^');
  const changed = (await git('diff', '--name-only', `${parent}..HEAD`)).split(
    '\n'
  );
  const packageJson = await readJson(join(cwd, 'package.json'));
  const tauri = await readJson(join(cwd, 'src-tauri/tauri.conf.json'));
  const manifest = await readFile(join(cwd, 'src-tauri/Cargo.toml'), 'utf8');
  const lock = await readFile(join(cwd, 'src-tauri/Cargo.lock'), 'utf8');
  const manifestVersion = manifest.match(
    /\[package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/
  )?.[1];
  const lockVersion = lock.match(
    /\[\[package\]\]\nname = "roadbooknavi"\nversion = "([^"]+)"/
  )?.[1];

  if (
    plan?.branch === branch &&
    plan.sourceHead === parent &&
    plan.version === nextRelease.version &&
    plan.tag === nextRelease.gitTag &&
    changed.every(path => assets.includes(path)) &&
    [packageJson?.version, tauri?.version, manifestVersion, lockVersion].every(
      version => version === plan.version
    )
  ) {
    // Only tag the commit containing the reviewed version changes. No branch push.
    const published = await semanticRelease(
      {
        ...coreOptions,
        dryRun: false,
        generateNotes: async () => plan.notes,
        verifyRelease: (_, { nextRelease: candidate }) => {
          if (candidate.version !== plan.version || candidate.gitHead !== head)
            throw new Error('The approved release changed before publication');
        },
      },
      context
    );
    if (published?.nextRelease) return reportRelease(plan);
    return { kind: 'none' };
  }

  // Refresh a stale version PR from its original changelog, avoiding duplicate entries.
  const pending =
    plan?.changelogBase &&
    /^[a-f0-9]{40,64}$/.test(plan.changelogBase) &&
    !(await git('tag', '--list', plan.tag));
  const changelogBase = pending
    ? plan.changelogBase
    : await git('rev-parse', 'HEAD:CHANGELOG.md');
  const changelog = (await exec('git', ['show', changelogBase], options))
    .stdout;
  await writeFile(join(cwd, 'CHANGELOG.md'), changelog);
  await prepareChangelog({}, { cwd, nextRelease, logger: { log } });
  await exec(
    process.execPath,
    [prepareScript, nextRelease.version, nextRelease.gitTag],
    options
  );
  await writeFile(
    join(cwd, planFile),
    `${JSON.stringify(
      {
        branch,
        sourceHead: head,
        version: nextRelease.version,
        tag: nextRelease.gitTag,
        changelogBase,
        notes: nextRelease.notes,
      },
      null,
      2
    )}\n`
  );

  const prBranch = `codex/release-${branch}`;
  const remoteHead = (
    await git('ls-remote', '--heads', 'origin', `refs/heads/${prBranch}`)
  ).split(/\s+/)[0];
  await git('switch', '-C', prBranch);
  await git('add', '--', ...assets);
  await exec(
    'git',
    [
      '-c',
      'user.name=github-actions[bot]',
      '-c',
      'user.email=41898282+github-actions[bot]@users.noreply.github.com',
      'commit',
      '-m',
      `chore(release): ${nextRelease.version}`,
    ],
    options
  );
  await git(
    'push',
    `--force-with-lease=refs/heads/${prBranch}:${remoteHead}`,
    'origin',
    `HEAD:refs/heads/${prBranch}`
  );
  const url = await github.upsertPr({
    branch,
    head: prBranch,
    version: nextRelease.version,
    notes: nextRelease.notes,
  });
  log(`Version PR awaiting your merge: ${url}`);
  return { kind: 'pull_request', url, version: nextRelease.version };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runRelease();
}
