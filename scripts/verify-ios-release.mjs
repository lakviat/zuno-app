import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const input = process.argv[2];
const signed = process.argv.includes('--signed');
assert(input, 'Usage: node scripts/verify-ios-release.mjs <Zuno.app|archive.xcarchive>');
const app = input.endsWith('.xcarchive')
  ? path.join(input, 'Products/Applications/Zuno.app')
  : input;
const plist = (file) =>
  JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', file], { encoding: 'utf8' }));
const info = plist(path.join(app, 'Info.plist'));
assert.equal(info.CFBundleDisplayName, 'Zuno');
assert.equal(
  info.CFBundleShortVersionString,
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version,
);
assert.match(info.CFBundleVersion, /^[1-9]\d*$/);
assert.equal(info.CFBundleIdentifier, 'app.zuno.mobile');
const sourceBuild = readFileSync(new URL('../app.config.ts', import.meta.url), 'utf8').match(
  /buildNumber: '([1-9]\d*)'/,
)?.[1];
assert.equal(
  info.CFBundleVersion,
  sourceBuild,
  'Artifact must use the current source build number',
);
assert(info.NSLocationWhenInUseUsageDescription?.includes('while open'));
assert.deepEqual(
  Object.keys(info).filter((key) => /^NS.*UsageDescription$/.test(key)),
  ['NSLocationWhenInUseUsageDescription'],
);
assert(!info.UIBackgroundModes?.length, 'Zuno uses foreground location only');
assert.equal(info.NSAppTransportSecurity.NSAllowsArbitraryLoads, false);
assert.equal(info.NSAppTransportSecurity.NSAllowsLocalNetworking, false);
assert.equal(info.EXDevMenuShowFloatingActionButton, false);
assert.equal(info.UIApplicationSceneManifest.UIApplicationSupportsMultipleScenes, false);
assert(info.CFBundleIcons.CFBundlePrimaryIcon.CFBundleIconName === 'AppIcon');
assert(existsSync(path.join(app, 'Assets.car')));
assert(existsSync(path.join(app, 'SplashScreen.storyboardc')));
const bundle = path.join(app, 'main.jsbundle');
assert(statSync(bundle).size > 100000, 'Release must contain an offline JS bundle');
const strings = execFileSync('strings', [bundle], {
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
});
for (const developmentOnly of [
  'Switch demo viewer',
  'Preview simulated movement (development)',
  'Try Noah to see what a non-friend',
  'Local phone preview',
  'zuno.local-phone.session.v1',
]) {
  assert(
    !strings.includes(developmentOnly),
    `Developer UI leaked into Release: ${developmentOnly}`,
  );
}
if (!process.env.EXPO_PUBLIC_SUPABASE_URL)
  assert(
    strings.includes('This build needs its account connection configured'),
    'Unconfigured Release must not bypass authentication',
  );
const manifests = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name === 'PrivacyInfo.xcprivacy') {
      const data = plist(file);
      for (const api of data.NSPrivacyAccessedAPITypes ?? [])
        assert(api.NSPrivacyAccessedAPITypeReasons?.length);
      manifests.push(path.relative(app, file));
    }
  }
}
walk(app);
assert(manifests.includes('PrivacyInfo.xcprivacy'));
assert(manifests.includes('ReactNativeMapsPrivacy.bundle/PrivacyInfo.xcprivacy'));
const privacy = plist(path.join(app, 'PrivacyInfo.xcprivacy'));
assert.equal(privacy.NSPrivacyTracking, false);
if (process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
  assert(
    strings.includes(process.env.EXPO_PUBLIC_SUPABASE_URL),
    'Release is missing its Supabase endpoint',
  );
  assert(
    strings.includes(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    'Release is missing its publishable client key',
  );
  assert(
    strings.includes('zuno://auth/callback'),
    'Release is missing its mobile sign-in callback',
  );
  for (const category of [
    'EmailAddress',
    'PhoneNumber',
    'Name',
    'UserID',
    'OtherUserContent',
    'PreciseLocation',
    'CoarseLocation',
    'PhotosorVideos',
  ]) {
    assert(
      privacy.NSPrivacyCollectedDataTypes.some(
        (item) =>
          item.NSPrivacyCollectedDataType === `NSPrivacyCollectedDataType${category}` &&
          item.NSPrivacyCollectedDataTypeLinked &&
          !item.NSPrivacyCollectedDataTypeTracking,
      ),
      'Account data must be declared in the privacy manifest',
    );
  }
}
for (const api of ['UserDefaults', 'FileTimestamp', 'SystemBootTime', 'DiskSpace']) {
  assert(
    privacy.NSPrivacyAccessedAPITypes.some(
      (item) => item.NSPrivacyAccessedAPIType === `NSPrivacyAccessedAPICategory${api}`,
    ),
  );
}
const arch = execFileSync('lipo', ['-archs', path.join(app, info.CFBundleExecutable)], {
  encoding: 'utf8',
}).trim();
if (input.endsWith('.xcarchive')) {
  assert.equal(info.DTPlatformName, 'iphoneos');
  assert.equal(arch, 'arm64');
  assert(existsSync(path.join(input, 'dSYMs/Zuno.app.dSYM')));
}
let signing;
if (signed) {
  const team = process.env.ZUNO_APPLE_TEAM_ID;
  assert.match(team ?? '', /^[A-Z0-9]{10}$/, 'Supply the expected Team for signing verification');
  assert.equal(info.DTPlatformName, 'iphoneos');
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'pipe' });
  const decodePlist = (xml) =>
    JSON.parse(
      execFileSync('plutil', ['-convert', 'json', '-o', '-', '-'], {
        input: xml,
        encoding: 'utf8',
      }),
    );
  const entitlements = decodePlist(
    execFileSync('codesign', ['-d', '--entitlements', ':-', app], {
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  );
  assert.equal(entitlements['com.apple.developer.team-identifier'], team);
  assert.equal(entitlements['application-identifier'], `${team}.${info.CFBundleIdentifier}`);
  assert.deepEqual(entitlements['com.apple.developer.applesignin'], ['Default']);
  assert(!entitlements['aps-environment'], 'Unimplemented push must remain disabled');
  const profileXML = execFileSync(
    'security',
    ['cms', '-D', '-i', path.join(app, 'embedded.mobileprovision')],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  // A full provisioning plist contains Date/Data values that plutil cannot
  // convert to JSON. Extract only the needed fields without logging certificates.
  const profileField = (key, format = 'json') =>
    execFileSync('plutil', ['-extract', key, format, '-o', '-', '-'], {
      input: profileXML,
      encoding: 'utf8',
    });
  const profile = {
    TeamIdentifier: JSON.parse(profileField('TeamIdentifier')),
    Entitlements: JSON.parse(profileField('Entitlements')),
    ExpirationDate: profileField('ExpirationDate', 'raw').trim(),
  };
  assert(profile.TeamIdentifier.includes(team));
  assert(
    new Date(profile.ExpirationDate).getTime() > Date.now(),
    'Provisioning profile has expired',
  );
  assert.equal(
    profile.Entitlements['application-identifier'],
    entitlements['application-identifier'],
  );
  assert(profile.Entitlements['com.apple.developer.applesignin']?.includes('Default'));
  signing = {
    verified: true,
    team,
    appleSignIn: true,
    push: false,
    developmentProfile: !!entitlements['get-task-allow'],
  };
}
console.log(
  JSON.stringify(
    {
      result: 'PASS',
      app,
      bundleIdentifier: info.CFBundleIdentifier,
      version: info.CFBundleShortVersionString,
      build: info.CFBundleVersion,
      platform: info.DTPlatformName,
      architectures: arch,
      minimumOS: info.MinimumOSVersion,
      ...(signing ? { signing } : {}),
      privacyManifests: manifests,
    },
    null,
    2,
  ),
);
