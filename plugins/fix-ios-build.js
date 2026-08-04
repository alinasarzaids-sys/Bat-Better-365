/**
 * Expo Config Plugin: Xcode 16 ObjC enumeration-redeclaration fix.
 *
 * Xcode 16 promotes NSInteger-typed enum redeclarations from a warning to a
 * hard error, which breaks any pod (e.g. RevenueCat native SDK) that still
 * carries the old typedef pattern.
 *
 * react-native-reanimated@3.17+ uses onGeometryChange — a SwiftUI API only
 * available in Xcode 16 — so we MUST build with Xcode 16 and suppress the
 * ObjC error rather than downgrade.
 *
 * This plugin appends a post_install hook to the generated Podfile that:
 *  - Disables GCC_TREAT_WARNINGS_AS_ERRORS and SWIFT_TREAT_WARNINGS_AS_ERRORS
 *  - Appends -Wno-error=redeclared-type to OTHER_OBJCFLAGS
 *  - Ensures every pod's IPHONEOS_DEPLOYMENT_TARGET >= 15.1
 *
 * iOS-only. Returns config unchanged for Android builds.
 */

module.exports = function withIosXcode16Fix(config) {
  // Skip entirely on Android EAS builds
  const platform = process.env.EAS_BUILD_PLATFORM || '';
  if (platform === 'android') return config;

  // Lazily resolve withDangerousMod so iOS EAS servers always find it
  let withDangerousMod;
  const candidates = ['@expo/config-plugins', 'expo/config-plugins'];
  for (const pkg of candidates) {
    try {
      const mod = require(pkg);
      withDangerousMod = mod.withDangerousMod;
      if (typeof withDangerousMod === 'function') break;
    } catch {
      // try next candidate
    }
  }

  if (typeof withDangerousMod !== 'function') {
    console.warn('[fix-ios-build] Could not load withDangerousMod — skipping Xcode 16 Podfile patch.');
    return config;
  }

  const fs = require('fs');
  const path = require('path');

  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.projectRoot, 'ios', 'Podfile');
      if (!fs.existsSync(podfilePath)) {
        console.warn('[fix-ios-build] Podfile not found — skipping patch.');
        return cfg;
      }

      let content = fs.readFileSync(podfilePath, 'utf-8');

      // Idempotent: skip if already patched
      if (content.includes('fix-ios-build-xcode16')) return cfg;

      // Ruby post_install block.
      // Note: #{...} is Ruby string interpolation — NOT JavaScript template syntax.
      const patch = `
# [fix-ios-build-xcode16] Xcode 16 ObjC NSInteger enum redeclaration fix
# Added automatically by plugins/fix-ios-build.js
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |build_config|
      # Turn off "warnings as errors" globally for all pods
      build_config.build_settings['GCC_TREAT_WARNINGS_AS_ERRORS'] = 'NO'
      build_config.build_settings['SWIFT_TREAT_WARNINGS_AS_ERRORS'] = 'NO'

      # Suppress the specific ObjC NSInteger redeclaration error
      existing_flags = build_config.build_settings['OTHER_OBJCFLAGS'] || '$(inherited)'
      unless existing_flags.include?('-Wno-error=redeclared-type')
        build_config.build_settings['OTHER_OBJCFLAGS'] = "#{existing_flags} -Wno-error=redeclared-type"
      end

      # Ensure minimum deployment target for Reanimated 3.17+ / Xcode 16
      current_target = (build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] || '0').to_f
      if current_target < 15.1
        build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
      end
    end
  end
end
`;

      fs.writeFileSync(podfilePath, content + '\n' + patch);
      console.log('[fix-ios-build] Podfile patched with Xcode 16 ObjC fix.');
      return cfg;
    },
  ]);
};
