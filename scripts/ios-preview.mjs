import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Build outside Desktop/iCloud: File Provider adds Finder metadata to generated
// Swift frameworks there, which causes Xcode's nested code-sign step to fail.
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const key = createHash('sha256').update(project).digest('hex').slice(0, 10);
const root = process.env.ZUNO_IOS_BUILD_ROOT || path.join(tmpdir(), `zuno-ios-${key}`);
const source = path.join(root, 'source');
const derived = path.join(root, 'DerivedData');
mkdirSync(source, { recursive: true });
const list = JSON.parse(
  execFileSync('xcrun', ['simctl', 'list', 'devices', 'available', '--json']),
);
const devices = Object.entries(list.devices)
  .filter(([runtime]) => runtime.includes('.iOS-'))
  .flatMap(([, values]) => values);
const requested = process.argv[2];
const device = requested
  ? devices.find((item) => item.udid === requested || item.name === requested)
  : devices.find((item) => item.state === 'Booted' && item.name.startsWith('iPhone')) ||
    devices.find((item) => item.name.startsWith('iPhone'));
if (!device)
  throw new Error(
    'No matching iOS simulator. Install an iPhone runtime in Xcode, or pass its simulator name/UDID.',
  );

function run(command, args, cwd, phase) {
  const log = path.join(root, `${phase}.log`);
  console.log(`${phase} · ${log}`);
  const fd = openSync(log, 'w');
  const result = spawnSync(command, args, { cwd, env: process.env, stdio: ['inherit', fd, fd] });
  closeSync(fd);
  if (result.error || result.status !== 0) {
    console.error(readFileSync(log, 'utf8').split('\n').slice(-35).join('\n'));
    throw result.error || new Error(`${phase} failed; see ${log}`);
  }
}

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
    '/dist/',
    '/docs/',
    '/public/',
    '.DerivedData/',
    '.build/',
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
run('pod', ['install'], path.join(source, 'ios'), 'pods');
if (device.state !== 'Booted') execFileSync('xcrun', ['simctl', 'boot', device.udid]);
execFileSync('xcrun', ['simctl', 'bootstatus', device.udid, '-b'], { stdio: 'inherit' });
run(
  'xcodebuild',
  [
    '-workspace',
    'ios/Zuno.xcworkspace',
    '-scheme',
    'Zuno',
    '-configuration',
    'Release',
    '-sdk',
    'iphonesimulator',
    '-destination',
    `id=${device.udid}`,
    '-derivedDataPath',
    derived,
    'CODE_SIGNING_ALLOWED=NO',
    'ONLY_ACTIVE_ARCH=YES',
    'build',
  ],
  source,
  'build',
);
const app = path.join(derived, 'Build/Products/Release-iphonesimulator/Zuno.app');
execFileSync('xcrun', ['simctl', 'install', device.udid, app], { stdio: 'inherit' });
execFileSync(
  'xcrun',
  ['simctl', 'launch', '--terminate-running-process', device.udid, 'app.zuno.mobile'],
  { stdio: 'inherit' },
);
console.log(
  `Zuno is running on ${device.name}. This standalone preview needs no Metro server or Expo Go.\nApp: ${app}`,
);
