const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

/** SDK 57 includes Expo's scene delegate, but its generated template still starts
 * a legacy UIWindow. iOS 27 requires the scene lifecycle at launch.
 */
module.exports = function withIOSScenes(config) {
  config = withInfoPlist(config, (mod) => {
    mod.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return mod;
  });
  return withAppDelegate(config, (mod) => {
    const marker = '// Zuno starts React Native from UIWindowScene.';
    let source = mod.modResults.contents;
    if (!source.includes(marker)) {
      const legacyWindow = /#if os\(iOS\) \|\| os\(tvOS\)\s+window = UIWindow[\s\S]*?#endif/;
      if (!legacyWindow.test(source) || !source.includes('class AppDelegate: ExpoAppDelegate {')) {
        throw new Error(
          'The Expo AppDelegate template changed; review the Zuno scene lifecycle plugin.',
        );
      }
      source = source.replace(
        'class AppDelegate: ExpoAppDelegate {',
        'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
      );
      source = source.replace(legacyWindow, `    ${marker}`);
      source += '\nclass SceneDelegate: ExpoAppSceneDelegate {}\n';
    }
    mod.modResults.contents = source;
    return mod;
  });
};
