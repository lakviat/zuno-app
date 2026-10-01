import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const input = process.argv[2];
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
assert.match(info.CFBundleIdentifier, /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/);
assert(info.NSLocationWhenInUseUsageDescription?.includes('while the app is open'));
assert.deepEqual(
  Object.keys(info).filter((key) => /^NS.*UsageDescription$/.test(key)),
  ['NSLocationWhenInUseUsageDescription'],
);
assert(!info.UIBackgroundModes?.length, 'Background modes are not used by this preview');
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
]) {
  assert(
    !strings.includes(developmentOnly),
    `Developer UI leaked into Release: ${developmentOnly}`,
  );
}
assert(strings.includes('Local preview'), 'Testers must know this build uses local sample data');
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
      privacyManifests: manifests,
    },
    null,
    2,
  ),
);
