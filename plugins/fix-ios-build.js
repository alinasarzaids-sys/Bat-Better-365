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
 *  - Disables SWIFT_ENABLE_EXPLICIT_MODULES to avoid "Module map file ...
 *    not found" archive failures caused by Xcode 16's explicit module scan
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

      // CocoaPods (1.12+) only supports a single `post_install` hook per
      // Podfile — defining a second top-level one raises "Specifying
      // multiple `post_install` hooks is unsupported." Expo's generated
      // Podfile already defines one inside the target block, so we splice
      // our logic into that existing block instead of adding our own.
      //
      // Ruby post_install block body.
      // Note: #{...} is Ruby string interpolation — NOT JavaScript template syntax.
      const patch = `
    # [fix-ios-build-xcode16] Xcode 16 ObjC NSInteger enum redeclaration fix
    # Added automatically by plugins/fix-ios-build.js
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

        # Xcode 16's Swift/Clang Explicit Module Builds scanners look for
        # each modular-header pod's .modulemap under BuildProductsPath
        # before that pod's own build phase has necessarily written it
        # there, causing "Module map file ... not found" during Archive
        # (both in the Swift compile step and, separately, in the Clang
        # bridging-header PCH precompile step — hence both settings below).
        # Fall back to the old implicit module resolution, which tolerates
        # this build-order gap.
        build_config.build_settings['SWIFT_ENABLE_EXPLICIT_MODULES'] = 'NO'
        build_config.build_settings['CLANG_ENABLE_EXPLICIT_MODULES'] = 'NO'

      end
    end

    # fmt (pulled in transitively via RCT-Folly) auto-detects Apple Clang's
    # consteval support with an upper-unbounded version check in
    # fmt/include/fmt/base.h — it has a known "consteval is broken in Apple
    # clang < 14" exclusion but no upper bound, so this newer toolchain
    # trips a *different* consteval regression fmt's blocklist doesn't know
    # about yet, breaking basic_format_string with "call to consteval
    # function ... is not a constant expression". A command-line
    # -DFMT_USE_CONSTEVAL=0 does NOT work here: the header unconditionally
    # re-#defines FMT_USE_CONSTEVAL itself with no #ifndef guard, clobbering
    # whatever we pass on the command line. So patch the vendored source
    # directly — safe because post_install runs after CocoaPods extracts a
    # fresh copy of the pod each 'pod install', so this reapplies every time.
    fmt_base_h = File.join(__dir__, 'Pods', 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base_h)
      fmt_content = File.read(fmt_base_h)
      broken_apple_clang_check = "defined(__apple_build_version__) && __apple_build_version__ < 14000029L"
      if fmt_content.include?(broken_apple_clang_check)
        fmt_content = fmt_content.sub(broken_apple_clang_check, "defined(__apple_build_version__)")
        File.chmod(0644, fmt_base_h) # CocoaPods vendors this header read-only
        File.write(fmt_base_h, fmt_content)
      end
    end

    # @stripe/stripe-react-native's own interop header forward-declares
    # STPPaymentStatus with the wrong underlying type (NSUInteger), while
    # the Stripe SDK's real Swift-generated header declares it NSInteger.
    # Older/looser Clang tolerated the mismatch; this toolchain treats it
    # as a hard "enumeration redeclared with different underlying type"
    # error. It's just a forward-declaration stub (no enum cases), so
    # matching the underlying type is a safe, correct fix. This lives in
    # node_modules, not Pods, so a 'yarn install' (independent of 'pod
    # install') can revert it — patch it here too so it reapplies whenever
    # post_install runs, regardless of node_modules state.
    stripe_interop_h = File.join(__dir__, '..', 'node_modules', '@stripe', 'stripe-react-native', 'ios', 'StripeSwiftInterop.h')
    if File.exist?(stripe_interop_h)
      stripe_content = File.read(stripe_interop_h)
      wrong_typedef = 'typedef NS_ENUM(NSUInteger, STPPaymentStatus);'
      if stripe_content.include?(wrong_typedef)
        stripe_content = stripe_content.sub(wrong_typedef, 'typedef NS_ENUM(NSInteger, STPPaymentStatus);')
        File.write(stripe_interop_h, stripe_content)
      end
    end

    # The app target itself (not just the Pods) triggers the same explicit
    # module scans. It lives in the main .xcodeproj, which CocoaPods reopens
    # and re-saves via its own in-memory copy AFTER post_install runs — so
    # we must edit through installer.aggregate_targets' user_project (the
    # same instance CocoaPods will save), not a freshly-opened one, or our
    # change gets silently overwritten.
    installer.aggregate_targets.each do |aggregate_target|
      aggregate_target.user_project.native_targets.each do |native_target|
        native_target.build_configurations.each do |build_config|
          build_config.build_settings['SWIFT_ENABLE_EXPLICIT_MODULES'] = 'NO'
          build_config.build_settings['CLANG_ENABLE_EXPLICIT_MODULES'] = 'NO'
        end
      end

      # hermes-engine ships a precompiled xcframework with no bundled dSYM,
      # and its own '[CP-User] [Hermes] Replace Hermes...' script phase
      # swaps in the final Debug/Release binary late in the build — after
      # whatever automatic dSYM Xcode might generate. App Store Connect's
      # validator then rejects the archive: the embedded framework's UUID
      # doesn't match any dSYM in the archive. Fix: append a script phase
      # to the app target (Xcodeproj appends new_shell_script_build_phase
      # to the end of build_phases, so this runs after every phase
      # CocoaPods/Expo already added, including Embed Frameworks and the
      # Hermes swap) that dsymutils the actual final embedded binary.
      main_target = aggregate_target.user_project.native_targets.find { |t| t.product_type == 'com.apple.product-type.application' }
      if main_target
        dsym_phase_name = 'fix-ios-build: generate hermes.framework dSYM'
        unless main_target.build_phases.any? { |p| p.respond_to?(:name) && p.name == dsym_phase_name }
          phase = main_target.new_shell_script_build_phase(dsym_phase_name)
          phase.shell_script = [
            'if [ "$CONFIGURATION" = "Release" ] && [ -n "$DWARF_DSYM_FOLDER_PATH" ]; then',
            '  HERMES_BINARY="$TARGET_BUILD_DIR/$FRAMEWORKS_FOLDER_PATH/hermes.framework/hermes"',
            '  if [ -f "$HERMES_BINARY" ]; then',
            '    mkdir -p "$DWARF_DSYM_FOLDER_PATH"',
            '    xcrun dsymutil "$HERMES_BINARY" -o "$DWARF_DSYM_FOLDER_PATH/hermes.framework.dSYM"',
            '  fi',
            'fi',
          ].join("\n")
        end
      end

      aggregate_target.user_project.save
    end
`;

      const hookAnchor = /post_install do \|installer\|\r?\n/;
      if (!hookAnchor.test(content)) {
        console.warn('[fix-ios-build] No post_install hook found in Podfile — skipping patch.');
        return cfg;
      }

      content = content.replace(hookAnchor, (match) => match + patch);

      fs.writeFileSync(podfilePath, content);
      console.log('[fix-ios-build] Podfile patched with Xcode 16 ObjC fix.');
      return cfg;
    },
  ]);
};
