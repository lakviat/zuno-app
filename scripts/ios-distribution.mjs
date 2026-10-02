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
import { withBackendEnvironment } from './backend-env.mjs';

// Unsigned by default. --signed explicitly uses the owner's configured Xcode
// account/Team for automatic provisioning. This script never exports or uploads.
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
const signed = process.argv.includes('--signed');
const device = process.argv
  .slice(2)
  .find((arg) => arg.startsWith('--device='))
  ?.slice(9);
if (
  process.argv
    .slice(2)
    .some(
      (arg) =>
        !['--prepare-only', '--signed'].includes(arg) && !/^--device=[A-Fa-f0-9-]+$/.test(arg),
    ) ||
  (prepareOnly && (signed || device)) ||
  (device && !signed)
)
  throw new Error(
    'Use --prepare-only, --signed [--device=<UDID>], or no arguments for an unsigned archive.',
  );
const env = {
  ...withBackendEnvironment(project),
  NODE_ENV: 'production',
  EXPO_NO_DOTENV: '1',
  ZUNO_BUILD_CHANNEL: 'testflight',
};
if (signed) {
  if (!/^[A-Z0-9]{10}$/.test(env.ZUNO_APPLE_TEAM_ID ?? ''))
    throw new Error(
      'Signed builds require your paid Apple Developer Team ID in ZUNO_APPLE_TEAM_ID and an authenticated Xcode account.',
    );
  if (!env.EXPO_PUBLIC_SUPABASE_URL || !env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    throw new Error('Signed beta builds require the hosted Supabase public client configuration.');
}

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
// Xcode launched from Finder does not inherit this process's environment. Keep
// its bundle phase aligned with the CLI archive using only public app settings.
// Never copy .env.local, provider secrets, or signing credentials into staging.
const quoteShell = (value) => `'${value.replaceAll("'", "'\\''")}'`;
const xcodeEnvironment = {
  NODE_BINARY: process.execPath,
  EXPO_NO_DOTENV: '1',
  ZUNO_BUILD_CHANNEL: 'testflight',
  EXPO_PUBLIC_SUPABASE_URL: env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  EXPO_PUBLIC_TERMS_URL: env.EXPO_PUBLIC_TERMS_URL,
  EXPO_PUBLIC_PRIVACY_URL: env.EXPO_PUBLIC_PRIVACY_URL,
};
writeFileSync(
  path.join(source, 'ios/.xcode.env.local'),
  '# Generated public app configuration for Xcode UI and CLI builds. No private credentials.\n' +
    Object.entries(xcodeEnvironment)
      .map(([name, value]) => `export ${name}=${quoteShell(value ?? '')}`)
      .join('\n') +
    '\n',
  { mode: 0o600 },
);
copyFileSync(path.join(project, 'native/ios/Podfile.lock'), path.join(source, 'ios/Podfile.lock'));
run('pod', ['install', '--deployment'], path.join(source, 'ios'), 'pods');
const workspace = path.join(source, 'ios/Zuno.xcworkspace');
console.log(
  `Prepared workspace: ${workspace}\nScheme: Zuno\nSigning: ${signed ? 'Automatic, owner-supplied Team' : 'not performed'}`,
);
if (!prepareOnly) {
  const stamp = new Date().toISOString().replace(/[-:.]/g, '');
  const archive = path.join(root, `Zuno-${signed ? 'signed' : 'unsigned'}-${stamp}.xcarchive`);
  const derivedData = path.join(root, signed ? 'DerivedData-signed' : 'DerivedData');
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
      device ? `platform=iOS,id=${device}` : 'generic/platform=iOS',
      '-sdk',
      'iphoneos',
      '-derivedDataPath',
      derivedData,
      ...(device ? [] : ['-archivePath', archive]),
      ...(signed
        ? [
            '-allowProvisioningUpdates',
            `DEVELOPMENT_TEAM=${env.ZUNO_APPLE_TEAM_ID}`,
            'CODE_SIGN_STYLE=Automatic',
          ]
        : ['CODE_SIGNING_ALLOWED=NO', 'CODE_SIGNING_REQUIRED=NO', 'CODE_SIGN_IDENTITY=']),
      device ? 'build' : 'archive',
    ],
    source,
    device ? 'device-release' : signed ? 'archive-signed' : 'archive',
  );
  const artifact = device
    ? path.join(derivedData, 'Build/Products/Release-iphoneos/Zuno.app')
    : archive;
  run(
    process.execPath,
    [
      path.join(project, 'scripts/verify-ios-release.mjs'),
      artifact,
      ...(signed ? ['--signed'] : []),
    ],
    project,
    'verification',
  );
  console.log(readFileSync(path.join(root, 'verification.log'), 'utf8'));
  if (!device)
    writeFileSync(
      path.join(root, signed ? 'latest-signed-archive.txt' : 'latest-archive.txt'),
      archive + '\n',
    );
  console.log(
    signed
      ? `Signed ${device ? 'device Release' : 'archive'}: ${artifact}\nNot uploaded. Validate/distribute through Xcode Organizer after physical-device acceptance.`
      : `Unsigned archive: ${archive}\nThis validates device code; it cannot be uploaded or installed without signing. Re-archive with your Team later.`,
  );
}
