/**
 * Expo Config Plugin: Exclude expo-video from Android build.
 *
 * expo-video's native VideoCache (SimpleCache) crashes on Android when the
 * OnSpace preview host app already holds the cache lock. Since this app uses
 * WebView (react-native-webview) for video — not expo-video — we exclude the
 * native module entirely from the Android package list.
 *
 * JS-side imports are already shimmed via metro.config.js → expo-video.js.
 */
const { createRunOncePlugin, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Remove expo-video from android/settings.gradle so Gradle never compiles it.
 */
const withExcludeExpoVideo = (config) => {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const settingsGradlePath = path.join(
        cfg.modRequest.platformProjectRoot,
        'settings.gradle'
      );

      if (!fs.existsSync(settingsGradlePath)) return cfg;

      let contents = fs.readFileSync(settingsGradlePath, 'utf8');

      // Remove the expo-video include line(s)
      contents = contents
        .split('\n')
        .filter((line) => !line.includes('expo-video'))
        .join('\n');

      fs.writeFileSync(settingsGradlePath, contents);
      return cfg;
    },
  ]);
};

module.exports = createRunOncePlugin(withExcludeExpoVideo, 'exclude-expo-video', '1.0.0');
