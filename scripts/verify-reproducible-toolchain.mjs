import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const rootPackage = readJson('package.json');
const workerPackage = readJson('worker/package.json');
const lock = readJson('package-lock.json');
const eas = readJson('eas.json');
const nvmrc = fs.readFileSync(path.join(root, '.nvmrc'), 'utf8').trim();
const npmrc = fs.readFileSync(path.join(root, '.npmrc'), 'utf8');

const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

function directSections(manifest) {
  return ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']
    .flatMap((section) => Object.entries(manifest[section] ?? {}).map(([name, version]) => ({ section, name, version })));
}

function assertExactManifest(manifest, label) {
  for (const { section, name, version } of directSections(manifest)) {
    assert(
      EXACT_VERSION.test(version),
      `${label} ${section}.${name} must use an exact semantic version, found ${JSON.stringify(version)}.`,
    );
  }
}

function assertLockManifest(manifest, lockEntry, label) {
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    const expected = manifest[section] ?? {};
    const actual = lockEntry?.[section] ?? {};
    assert(
      JSON.stringify(actual) === JSON.stringify(expected),
      `${label} ${section} does not match package-lock.json metadata.`,
    );
  }
}

function assertResolvedVersions(manifest, label) {
  for (const { section, name, version } of directSections(manifest)) {
    if (section === 'peerDependencies') continue;
    const installed = lock.packages?.[`node_modules/${name}`]?.version;
    assert(installed === version, `${label} ${name} resolves to ${installed ?? 'missing'}, expected ${version}.`);
  }
}

assert(lock.lockfileVersion === 3, `package-lock.json must use lockfileVersion 3, found ${lock.lockfileVersion}.`);
assert(rootPackage.packageManager === 'npm@10.8.2', 'Root packageManager must be npm@10.8.2.');
assert(rootPackage.engines?.node === '20.19.4', 'Root Node engine must be 20.19.4.');
assert(rootPackage.engines?.npm === '10.8.2', 'Root npm engine must be 10.8.2.');
assert(nvmrc === '20.19.4', '.nvmrc must be 20.19.4.');
assert(npmrc.includes('save-exact=true'), '.npmrc must require exact dependency saves.');
assert(npmrc.includes('package-lock=true'), '.npmrc must require package-lock.json.');
assert(workerPackage.engines?.node === '>=22.0.0', 'Legacy Worker must declare its Wrangler Node 22 runtime.');

assertExactManifest(rootPackage, 'Root');
assertExactManifest(workerPackage, 'Worker');
assertLockManifest(rootPackage, lock.packages?.[''], 'Root');
assertLockManifest(workerPackage, lock.packages?.worker, 'Worker');
assertResolvedVersions(rootPackage, 'Root');
assertResolvedVersions(workerPackage, 'Worker');

assert(eas.build?.base?.node === '20.19.4', 'EAS base profile must pin Node 20.19.4.');
for (const profile of ['development', 'preview', 'production']) {
  assert(eas.build?.[profile]?.extends === 'base', `EAS ${profile} profile must extend the pinned base profile.`);
}

if (failures.length > 0) {
  console.error('Reproducible toolchain verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Horos reproducible toolchain: PASS');
console.log(`Node ${rootPackage.engines.node}; npm ${rootPackage.engines.npm}; ${Object.keys(rootPackage.dependencies).length} runtime dependencies pinned.`);
