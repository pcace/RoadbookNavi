#!/usr/bin/env node
// Builds the OBF bridge classpath from an OsmAnd java-tools checkout.
//
// Layout (mirrors the BRouter vendoring in build-routing-engine.mjs):
//   OSMAND_TOOLS=<path>/OsmAnd-tools/java-tools node scripts/build-obf-bridge.mjs
//
// Requires sibling checkouts per OsmAnd's own CI layout:
//   <root>/OsmAnd-tools/java-tools          (tools, contains ObfProbe module)
//   <root>/android/OsmAnd-java              (the library, per settings.gradle)
//   <root>/android/OsmAnd-shared
//   <root>/resources                        (osmandapp/OsmAnd-resources)
// JAVA_HOME must point to a JDK 17+.
//
// Output: native/obf-bridge/resources/lib/*.jar (all runtime deps, gitignored)
// plus native/obf-bridge/SOURCE.json (provenance).
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(new URL('..', import.meta.url).pathname);
const tools = resolve(process.env.OSMAND_TOOLS || join(root, '..', 'OsmAnd-tools', 'java-tools'));
const module_ = join(tools, 'ObfProbe');

if (!existsSync(join(tools, 'gradlew'))) {
  console.error(`OsmAnd java-tools checkout not found at ${tools}. Set OSMAND_TOOLS.`);
  process.exit(1);
}

const javaHome = process.env.JAVA_HOME;
const javaTool = (tool) => (javaHome ? join(javaHome, 'bin', tool) : tool);

// 1. Vendor the bridge sources into the module (sources of truth: this repo).
cpSync(join(root, 'native', 'obf-bridge', 'src'), join(module_, 'src', 'main', 'java'), {
  recursive: true,
});

// 2. Collect OsmAnd resources into the library jar, then build the installDist
//    (bin/ + lib/*.jar with every runtime dependency).
const gradle = ['collectMiscResources', 'collectRenderingStylesResources', 'collectRoutingResources', 'jar'].map(
  (t) => `:OsmAnd-java:${t}`
);
execFileSync(join(tools, 'gradlew'), [...gradle, ':ObfProbe:installDist', '--no-daemon'], {
  cwd: tools,
  env: { ...process.env, JAVA_HOME: javaHome },
  stdio: 'inherit',
});

// 3. Copy the classpath into the Tauri resources area.
const libSrc = join(module_, 'build', 'install', 'ObfProbe', 'lib');
const libDst = join(root, 'native', 'obf-bridge', 'resources', 'lib');
rmSync(libDst, { recursive: true, force: true });
mkdirSync(libDst, { recursive: true });
cpSync(libSrc, libDst, { recursive: true });

// 4. Provenance (BRouter SOURCE.json pattern).
let commit = 'unknown';
try {
  commit = execFileSync('git', ['-C', tools, 'rev-parse', 'HEAD']).toString().trim();
} catch {}
writeFileSync(
  join(root, 'native', 'obf-bridge', 'SOURCE.json'),
  `${JSON.stringify({ javaTools: tools, commit, built: new Date().toISOString() }, null, 2)}\n`
);

const jars = existsSync(libDst) ? readdirSync(libDst).length : 0;
console.log(`Built OBF bridge classpath into ${libDst} (${jars} jars)`);