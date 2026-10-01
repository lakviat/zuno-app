import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// No Apple login, signing, export, upload or external build service is invoked here.
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const key = createHash('sha256').update(project).digest('hex').slice(0, 10);
const root = path.join(homedir(), 'Library/Developer/Zuno', `TestFlight-${key}`);
const source = path.join(root, 'source');
const marker = path.join(root, '.zuno-managed-build');
if (existsSync(root) && (!existsSync(marker) || readFileSync(marker, 'utf8') !== project)) {
  throw new Error(`Refusing to modify an unrecognized build directory: ${root}`);
}
mkdirSync(source, { recursive: true });
writeFileSync(marker, project);
const prepareOnly = process.argv.includes('--prepare-only');
if (process.argv.slice(2).some((arg) => arg !== '--prepare-only'))
  throw new Error('Only --prepare-only is supported.');
const env = {
  ...process.env,
  NODE_ENV: 'production',
  EXPO_NO_DOTENV: '1',
  ZUNO_BUILD_CHANNEL: 'testflight',
};

function run(command, args, cwd, phase) {
  const log = path.join(root, `${phase}.log`);
  console.log(`${phase}: ${log}`);
  const fd = openSync(log, 'w');
  const result = spawnSync(command, args, { cwd, env, stdio: ['ignore', fd, fd] });
  closeSync(fd);
  if (result.error || result.status !== 0) {
    console.error(readFileSync(log, 'utf8').split('\n').slice(-35).join('\n'));
    throw result.error || new Error(`${phase} failed; see ${log}`);
  }
}

// Isolate generated native artifacts from Desktop/iCloud metadata. --delete only
// touches our marked staging directory. Never copy credentials or private .env files.
execFileSync('rsync', [
  '-a',
  '--delete',
  ...[
    '/.git/',
    '/.idea/',
    '/ios/',
    '/android/',
    '/.expo/',
    '/test-results/',
    '/playwright-report/',
    '/dist/',
    '/dist-native/',
    '/web-build/',
    '/docs/screenshots/',
    '/public/',
    '/release-artifacts/',
    '.env',
    '.env.*',
    '*.p8',
    '*.p12',
    '*.pem',
    '*.key',
    '*.mobileprovision',
    '*.xcarchive/',
    '*.xcresult/',
  ].map((pattern) => `--exclude=${pattern}`),
  `${project}/`,
  `${source}/`,
]);
run(
  process.execPath,
  ['node_modules/expo/bin/cli', 'prebuild', '--platform', 'ios', '--no-install'],
  source,
  'prebuild',
);
copyFileSync(path.join(project, 'native/ios/Podfile.lock'), path.join(source, 'ios/Podfile.lock'));
run('pod', ['install', '--deployment'], path.join(source, 'ios'), 'pods');
const workspace = path.join(source, 'ios/Zuno.xcworkspace');
console.log(
  `Prepared workspace: ${workspace}\nScheme: Zuno\nAccount/signing is intentionally not configured by this script.`,
);
if (!prepareOnly) {
  const stamp = new Date().toISOString().replace(/[-:.]/g, '');
  const archive = path.join(root, `Zuno-unsigned-${stamp}.xcarchive`);
  run(
    'xcodebuild',
    [
      '-workspace',
      workspace,
      '-scheme',
      'Zuno',
      '-configuration',
      'Release',
      '-destination',
      'generic/platform=iOS',
      '-sdk',
      'iphoneos',
      '-derivedDataPath',
      path.join(root, 'DerivedData'),
      '-archivePath',
      archive,
      'CODE_SIGNING_ALLOWED=NO',
      'CODE_SIGNING_REQUIRED=NO',
      'CODE_SIGN_IDENTITY=',
      'archive',
    ],
    source,
    'archive',
  );
  run(
    process.execPath,
    [path.join(project, 'scripts/verify-ios-release.mjs'), archive],
    project,
    'verification',
  );
  console.log(readFileSync(path.join(root, 'verification.log'), 'utf8'));
  writeFileSync(path.join(root, 'latest-archive.txt'), archive + '\n');
  console.log(
    `Unsigned archive: ${archive}\nThis validates device code; it cannot be uploaded or installed without signing. Re-archive with your Team in Xcode later.`,
  );
}
