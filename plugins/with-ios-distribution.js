const { withXcodeProject, withPodfileProperties, IOSConfig } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

/** Keep distribution fixes reproducible: ios/ is generated and is not the source of truth. */
module.exports = function withIOSDistribution(config) {
  config = withPodfileProperties(config, (mod) => {
    mod.modResults.EX_DEV_CLIENT_NETWORK_INSPECTOR = 'false';
    return mod;
  });
  return withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const configurations = project.pbxXCBuildConfigurationSection();
    for (const entry of Object.values(configurations)) {
      if (!entry || typeof entry !== 'object' || !entry.buildSettings) continue;
      const settings = entry.buildSettings;
      // Let automatic signing select identities later; no certificate or team is baked in.
      delete settings['"CODE_SIGN_IDENTITY[sdk=iphoneos*]"'];
      if (!settings.PRODUCT_BUNDLE_IDENTIFIER) continue;
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
