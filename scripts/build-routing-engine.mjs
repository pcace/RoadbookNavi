import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = resolve(process.env.BROUTER_SOURCE || join(root, '../brouter'));
const target = join(root, 'native/brouter');
const modules = [
  'brouter-core',
  'brouter-mapaccess',
  'brouter-expressions',
  'brouter-codec',
  'brouter-util',
];

if (!existsSync(join(source, 'LICENSE'))) {
  throw new Error('BROUTER_SOURCE must point to a BRouter checkout.');
}

mkdirSync(join(target, 'vendor'), { recursive: true });
for (const module of modules) {
  cpSync(
    join(source, module, 'src/main/java'),
    join(target, 'vendor', module),
    { recursive: true }
  );
}

mkdirSync(join(target, 'resources/profiles2'), { recursive: true });
cpSync(join(source, 'misc/profiles2'), join(target, 'resources/profiles2'), {
  recursive: true,
});
// Project profiles override upstream defaults on every supported platform.
cpSync(join(root, 'native/profiles'), join(target, 'resources/profiles2'), {
  recursive: true,
});
cpSync(join(source, 'LICENSE'), join(target, 'resources/BROUTER-LICENSE.txt'));
writeFileSync(
  join(target, 'resources/SOURCE.json'),
  JSON.stringify(
    {
      repository: 'https://github.com/abrensch/brouter',
      commit: execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], {
        encoding: 'utf8',
      }).trim(),
    },
    null,
    2
  )
);

const javaSources = directory =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return javaSources(path);
    return entry.name.endsWith('.java') ? [path] : [];
  });
const buildDirectory = join(target, 'build');
mkdirSync(buildDirectory, { recursive: true });

const javaHome = process.env.JAVA_HOME;
const javaTool = tool =>
  javaHome
    ? join(javaHome, 'bin', tool + (process.platform === 'win32' ? '.exe' : ''))
    : tool;

execFileSync(
  javaTool('javac'),
  [
    '--release',
    '11',
    '-d',
    buildDirectory,
    ...javaSources(join(target, 'vendor')),
    ...javaSources(join(target, 'src')),
  ],
  { stdio: 'inherit' }
);
execFileSync(
  javaTool('jar'),
  [
    '--create',
    '--file',
    join(target, 'resources/brouter.jar'),
    '--main-class',
    'de.roadbooknavi.routing.OfflineRouter',
    '-C',
    buildDirectory,
    '.',
  ],
  { stdio: 'inherit' }
);

if (!process.argv.includes('--android')) {
  const runtime = join(target, 'resources/runtime');
  if (existsSync(runtime)) rmSync(runtime, { recursive: true, force: true });
  execFileSync(
    javaTool('jlink'),
    [
      '--add-modules',
      'java.base,java.logging,java.xml',
      '--strip-debug',
      '--no-header-files',
      '--no-man-pages',
      '--output',
      runtime,
    ],
    { stdio: 'inherit' }
  );

  // jlink creates read-only license files, while Tauri needs to refresh copied
  // resources during subsequent builds.
  const makeWritable = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) makeWritable(path);
      else if (entry.isFile()) chmodSync(path, statSync(path).mode | 0o200);
    }
  };
  makeWritable(runtime);
}

console.log('Built BRouter and routing profiles in', target);
