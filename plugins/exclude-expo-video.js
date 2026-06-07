/**
 * Expo Config Plugin: Exclude expo-video from Android build.
 *
 * expo-video's native VideoCache (SimpleCache) crashes on Android when the
 * OnSpace preview host app already holds the cache lock. Since this app uses
 * WebView (react-native-webview) for video — not expo-video — we exclude the
 * native module entirely from the Android package list.
 *
 * JS-side imports are already shimmed via metro.config.js → expo-video.js.
 *
 * NOTE: This plugin is Android-only. It exits immediately on iOS builds to
 * avoid @expo/config-plugins resolution failures on EAS iOS build servers.
 */
const fs = require('fs');
const path = require('path');

/**
 * Remove expo-video from android/settings.gradle so Gradle never compiles it.
 */
function withExcludeExpoVideo(config) {
  // This plugin only modifies Android settings.gradle.
  // Exit immediately for iOS builds — EAS iOS servers may not resolve @expo/config-plugins.
  const platform = process.env.EAS_BUILD_PLATFORM || '';
  if (platform === 'ios') {
    return config;
  }

  // Try multiple resolution paths for @expo/config-plugins
  let withDangerousMod;
  let createRunOncePlugin;

  const candidates = [
    '@expo/config-plugins',
    'expo/config-plugins',
  ];

  for (const pkg of candidates) {
    try {
      const mod = require(pkg);
      withDangerousMod = mod.withDangerousMod;
      createRunOncePlugin = mod.createRunOncePlugin;
      if (typeof withDangerousMod === 'function') break;
    } catch (e) {
      // try next candidate
    }
  }

  if (typeof withDangerousMod !== 'function') {
    console.warn(
      '[exclude-expo-video] Could not load withDangerousMod; skipping expo-video exclusion. ' +
      'This is non-fatal for iOS builds.'
    );
    return config;
  }

  const pluginFn = (cfg) => {
    return withDangerousMod(cfg, [
      'android',
      async (innerCfg) => {
        try {
          const settingsGradlePath = path.join(
            innerCfg.modRequest.platformProjectRoot,
            'settings.gradle'
          );

          if (!fs.existsSync(settingsGradlePath)) return innerCfg;

          let contents = fs.readFileSync(settingsGradlePath, 'utf8');

          // Remove the expo-video include line(s)
          contents = contents
            .split('\n')
            .filter((line) => !line.includes('expo-video'))
            .join('\n');

          fs.writeFileSync(settingsGradlePath, contents);
        } catch (e) {
          console.warn('[exclude-expo-video] settings.gradle patch failed, skipping:', e.message);
        }
        return innerCfg;
      },
    ]);
  };

  if (typeof createRunOncePlugin === 'function') {
    return createRunOncePlugin(pluginFn, 'exclude-expo-video', '1.0.0')(config);
  }

  return pluginFn(config);
}

module.exports = withExcludeExpoVideo;
