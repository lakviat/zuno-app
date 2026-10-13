const {
  withXcodeProject,
  withPodfileProperties,
  withEntitlementsPlist,
  withFinalizedMod,
  IOSConfig,
} = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');
const plist = require('@expo/plist').default;
const xcode = require('xcode');

/** Keep distribution fixes reproducible: ios/ is generated and is not the source of truth. */
module.exports = function withIOSDistribution(config) {
  // Expo auto-applies its notifications plugin. Permission/status UI does not need
  // APNs; enable this entitlement only together with a real push sender/registry.
  config = withEntitlementsPlist(config, (mod) => {
    delete mod.modResults['aps-environment'];
    return mod;
  });
  config = withPodfileProperties(config, (mod) => {
    mod.modResults.EX_DEV_CLIENT_NETWORK_INSPECTOR = 'false';
    return mod;
  });
  config = withFinalizedMod(config, [
    'ios',
    (mod) => {
      // Copy the final plist after every permission/scene plugin has run. Only
      // Debug may connect to Metro; Release continues using the original plist.
      const ios = mod.modRequest.platformProjectRoot;
      const debugPlist = plist.parse(fs.readFileSync(path.join(ios, 'Zuno/Info.plist'), 'utf8'));
      debugPlist.NSAppTransportSecurity = {
        ...debugPlist.NSAppTransportSecurity,
        NSAllowsLocalNetworking: true,
      };
      debugPlist.NSLocalNetworkUsageDescription =
        'Connect to the Metro development server on your Mac while developing Zuno.';
      fs.writeFileSync(path.join(ios, 'Zuno/Info-Debug.plist'), plist.build(debugPlist));
      const project = xcode.project(path.join(ios, 'Zuno.xcodeproj/project.pbxproj'));
      project.parseSync();
      for (const entry of Object.values(project.pbxXCBuildConfigurationSection())) {
        if (entry?.buildSettings?.PRODUCT_BUNDLE_IDENTIFIER && entry.name === 'Debug') {
          entry.buildSettings.INFOPLIST_FILE = 'Zuno/Info-Debug.plist';
        }
      }
      fs.writeFileSync(project.filepath, project.writeSync());
      return mod;
    },
  ]);
  return withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const configurations = project.pbxXCBuildConfigurationSection();
    for (const entry of Object.values(configurations)) {
      if (!entry || typeof entry !== 'object' || !entry.buildSettings) continue;
      const settings = entry.buildSettings;
      // CocoaPods' resource-copy and React Native bundle phases write generated
      // files outside their declared outputs. Xcode's recommended-settings action
      // can enable script sandboxing and break ordinary Debug/Release builds.
      // This controls build scripts only; it does not change app permissions.
      settings.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';
      // Let automatic signing select identities later; no certificate or team is baked in.
      delete settings['"CODE_SIGN_IDENTITY[sdk=iphoneos*]"'];
      if (!settings.PRODUCT_BUNDLE_IDENTIFIER) continue;
      // Keep Expo's plist provider on the canonical file during regeneration.
      // The finalized mod selects its Debug copy after all plist mods finish.
      settings.INFOPLIST_FILE = 'Zuno/Info.plist';
      settings.CODE_SIGN_STYLE = 'Automatic';
      settings.MARKETING_VERSION = config.version;
      settings.CURRENT_PROJECT_VERSION = config.ios.buildNumber;
      if (entry.name === 'Release') {
        settings.SWIFT_OPTIMIZATION_LEVEL = '"-O"';
        settings.DEBUG_INFORMATION_FORMAT = '"dwarf-with-dsym"';
        settings.ENABLE_TESTABILITY = 'NO';
        settings.ONLY_ACTIVE_ARCH = 'NO';
        settings.VALIDATE_PRODUCT = 'YES';
      }
    }

    const ios = mod.modRequest.platformProjectRoot;
    const app = path.join(ios, 'Zuno');
    const scheme = path.join(ios, 'Zuno.xcodeproj/xcshareddata/xcschemes/Zuno.xcscheme');
    // Expo's template references an XCTest target that does not exist in this project.
    if (
      fs.existsSync(scheme) &&
      !Object.values(project.pbxNativeTargetSection()).some(
        (target) => target && typeof target === 'object' && /ZunoTests/.test(target.name),
      )
    ) {
      const original = fs.readFileSync(scheme, 'utf8');
      fs.writeFileSync(
        scheme,
        original.replace(
          /\s*<TestableReference\b[\s\S]*?BlueprintName = "ZunoTests"[\s\S]*?<\/TestableReference>/g,
          '',
        ),
      );
    }

    // The SDK 57 bare template references a nonexistent SplashScreen image. Reuse
    // Zuno's existing artwork, rather than adding another splash dependency.
    const images = path.join(app, 'Images.xcassets/SplashScreen.imageset');
    fs.mkdirSync(images, { recursive: true });
    fs.copyFileSync(
      path.join(mod.modRequest.projectRoot, 'assets/splash-icon.png'),
      path.join(images, 'zuno.png'),
    );
    fs.writeFileSync(
      path.join(images, 'Contents.json'),
      JSON.stringify(
        {
          images: [{ idiom: 'universal', filename: 'zuno.png', scale: '2x' }],
          info: { version: 1, author: 'Zuno' },
        },
        null,
        2,
      ),
    );
    const storyboard = path.join(app, 'SplashScreen.storyboard');
    if (fs.existsSync(storyboard)) {
      fs.writeFileSync(
        storyboard,
        fs
          .readFileSync(storyboard, 'utf8')
          .replace(
            /<image name="SplashScreenLogo"[^>]*\/>/,
            '<image name="SplashScreen" width="100" height="100"/>',
          ),
      );
    }

    // react-native-maps 1.27.2 supplies this manifest but its Apple Maps podspec
    // omits it from resources. Preserve the SDK author's declarations verbatim.
    const bundle = path.join(app, 'ReactNativeMapsPrivacy.bundle');
    fs.mkdirSync(bundle, { recursive: true });
    fs.copyFileSync(
      path.join(
        mod.modRequest.projectRoot,
        'node_modules/react-native-maps/ios/PrivacyInfo.xcprivacy',
      ),
      path.join(bundle, 'PrivacyInfo.xcprivacy'),
    );
    const relative = 'Zuno/ReactNativeMapsPrivacy.bundle';
    if (!project.hasFile(relative)) {
      IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath: relative,
        groupName: 'Zuno',
        project,
        isBuildFile: true,
      });
    }
    return mod;
  });
};
