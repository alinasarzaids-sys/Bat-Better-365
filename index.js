// ─── Silence known container warnings ────────────────────────────────────────
import { LogBox } from 'react-native';
LogBox.ignoreLogs([
  'Another SimpleCache instance',
  'ExpoVideoCache',
  'NativeUnimoduleProxy',
  'Exception in HostObject::get for prop',
  'SimpleCache',
]);

// ─── Phase 1: CREATE + patch NativeModules entries ───────────────────────────
// Critical fix: NativeModules.ExpoFont / ExpoFontLoader are NULL (not just
// missing) in the OnSpace Android container. The previous guard `obj && ...`
// skipped null values. We now unconditionally CREATE stub objects so that
// expo-font's module-level code captures a valid reference at evaluation time.
(function patchNativeModules() {
  try {
    const RN = require('react-native');
    const NM = RN && RN.NativeModules;
    if (!NM) return;

    const fontStub = {
      isLoadedNative: function () { return false; },
      isLoaded: function () { return false; },
      getLoadedFonts: function () { return []; },
      loadAsync: function () { return Promise.resolve(); },
      unloadAllAsync: function () { return Promise.resolve(); },
    };

    // Create the stub objects if null/undefined — this is the key fix.
    // expo-font captures a module-level reference; if that ref is null,
    // calling .isLoadedNative() inside it crashes regardless of later patches.
    if (!NM.ExpoFont) NM.ExpoFont = Object.assign({}, fontStub);
    if (!NM.ExpoFontLoader) NM.ExpoFontLoader = Object.assign({}, fontStub);
    if (!NM.RNVectorIcons) NM.RNVectorIcons = Object.assign({}, fontStub);

    // Patch any already-existing (but incomplete) native module objects
    const patchObj = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      if (typeof obj.isLoadedNative !== 'function') obj.isLoadedNative = fontStub.isLoadedNative;
      if (typeof obj.isLoaded !== 'function') obj.isLoaded = fontStub.isLoaded;
      if (typeof obj.getLoadedFonts !== 'function') obj.getLoadedFonts = fontStub.getLoadedFonts;
      if (typeof obj.loadAsync !== 'function') obj.loadAsync = fontStub.loadAsync;
    };

    patchObj(NM.ExpoFont);
    patchObj(NM.ExpoFontLoader);
    patchObj(NM.RNVectorIcons);

    // NativeUnimoduleProxy constants table (SDK 48 compatibility)
    try {
      const proxy = NM.NativeUnimoduleProxy;
      if (proxy && proxy.modulesConstantsMap) {
        if (!proxy.modulesConstantsMap.ExpoFont) proxy.modulesConstantsMap.ExpoFont = Object.assign({}, fontStub);
        if (!proxy.modulesConstantsMap.ExpoFontLoader) proxy.modulesConstantsMap.ExpoFontLoader = Object.assign({}, fontStub);
        patchObj(proxy.modulesConstantsMap.ExpoFont);
        patchObj(proxy.modulesConstantsMap.ExpoFontLoader);
      }
    } catch (_) {}

  } catch (_) {}
})();

// ─── Phase 2: Override JS-layer expo-font so isLoaded always returns true ────
// Even if native stubs are in place, the internal `isLoadedNative` closure in
// the expo-font bundle may still reference the original null value captured at
// module eval time. We override `isLoaded` at the JS export layer to short-
// circuit before it ever reaches the native call.
(function patchExpoFontJS() {

  // 2a — ExpoFont native proxy wrapper
  try {
    const m = require('expo-font/build/ExpoFont');
    const target = (m && m.default) ? m.default : m;
    if (target && typeof target === 'object') {
      target.isLoadedNative = () => false;
      target.getLoadedFonts = () => [];
      target.loadAsync = () => Promise.resolve();
    }
  } catch (_) {}

  // 2b — Font.isLoaded: override to return TRUE so Icon never triggers a load
  // This is the critical override — returning true means "font is ready",
  // bypassing the native check that crashes on this container.
  try {
    const m = require('expo-font/build/Font');
    if (m) {
      m.isLoadedNative = () => false;
      // Return true so @expo/vector-icons skips any reload attempt
      m.isLoaded = () => true;
      if (typeof m.loadAsync !== 'function') m.loadAsync = () => Promise.resolve();
    }
  } catch (_) {}

  // 2c — top-level expo-font barrel export
  try {
    const m = require('expo-font');
    if (m) {
      m.isLoadedNative = () => false;
      m.isLoaded = () => true;
      if (typeof m.loadAsync !== 'function') m.loadAsync = () => Promise.resolve();
    }
  } catch (_) {}

  // 2d — FontLoader module (SDK 50+)
  try {
    const m = require('expo-font/build/FontLoader');
    if (m) {
      m.isLoadedNative = () => false;
      m.isLoaded = () => true;
    }
  } catch (_) {}

  // 2e — Server module fallback (some bundler configs)
  try {
    const m = require('expo-font/build/server');
    if (m && typeof m.isLoaded !== 'function') {
      m.isLoaded = () => true;
    }
  } catch (_) {}

})();

// ─── Phase 3: Guard AppRegistry so "main has not been registered" never fires ─
(function guardAppRegistry() {
  try {
    const { AppRegistry } = require('react-native');
    if (AppRegistry) {
      const orig = AppRegistry.registerComponent;
      AppRegistry.registerComponent = function (name, componentProvider) {
        try {
          return orig.call(AppRegistry, name, componentProvider);
        } catch (err) {
          console.warn('[index.js] registerComponent failed:', err);
        }
      };
    }
  } catch (_) {}
})();

// ─── Entry point ──────────────────────────────────────────────────────────────
import 'expo-router/entry';
