/**
 * Expo config plugin: force com.revenuecat.purchases:purchases to 10.6.2+
 * Resolves Google Play SDK warning about version 10.6.0 making unnecessary API calls.
 * Android only — iOS builds are skipped immediately.
 */
module.exports = function withForceRevenueCatVersion(config) {
  // iOS builds — nothing to do
  if (process.env.EAS_BUILD_PLATFORM === 'ios') {
    return config;
  }

  try {
    const { withProjectBuildGradle } = require('@expo/config-plugins');

    return withProjectBuildGradle(config, (gradleConfig) => {
      const FORCE_VERSION = 'com.revenuecat.purchases:purchases:10.6.2';
      const contents = gradleConfig.modResults.contents;

      // Idempotent — skip if already patched
      if (contents.includes(FORCE_VERSION)) {
        return gradleConfig;
      }

      // Insert a resolutionStrategy inside the existing allprojects block
      // so Gradle forces the patched native SDK regardless of transitive deps
      const patched = contents.replace(
        /(allprojects\s*\{)/,
        `$1\n    configurations.all {\n        resolutionStrategy {\n            force '${FORCE_VERSION}'\n        }\n    }`
      );

      if (patched === contents) {
        // allprojects block not found — append a standalone block at the bottom
        gradleConfig.modResults.contents =
          contents +
          `\nconfigurations.all {\n    resolutionStrategy {\n        force '${FORCE_VERSION}'\n    }\n}\n`;
      } else {
        gradleConfig.modResults.contents = patched;
      }

      console.log(`[force-revenuecat-version] Forced ${FORCE_VERSION} in root build.gradle`);
      return gradleConfig;
    });
  } catch (e) {
    // Bail gracefully if @expo/config-plugins is unavailable
    console.log('[force-revenuecat-version] Skipped:', e.message);
    return config;
  }
};
