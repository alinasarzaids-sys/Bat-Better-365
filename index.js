// ─── Silence known container warnings ────────────────────────────────────────
import { LogBox } from 'react-native';
LogBox.ignoreLogs([
  'Another SimpleCache instance',
  'ExpoVideoCache',
  'NativeUnimoduleProxy',
  'Exception in HostObject::get for prop',
  'SimpleCache',
]);

// ─── Phase 1: Patch NativeModules before any module graph loads ───────────────
// The OnSpace Android container may not have ExpoFont / ExpoFontLoader native
// bindings. Patching isLoadedNative here ensures every module that calls it
// gets a safe no-op instead of crashing.
(function patchNativeModules() {
  try {
    const RN = require('react-native');
    const NM = RN && RN.NativeModules;
    if (!NM) return;

    const ensureIsLoaded = (obj) => {
      if (obj && typeof obj === 'object') {
        if (typeof obj.isLoadedNative !== 'function') {
          obj.isLoadedNative = function () { return false; };
        }
        if (typeof obj.isLoaded !== 'function') {
          obj.isLoaded = function () { return false; };
        }
        if (typeof obj.getLoadedFonts !== 'function') {
          obj.getLoadedFonts = function () { return []; };
        }
        if (typeof obj.loadAsync !== 'function') {
          obj.loadAsync = function () { return Promise.resolve(); };
        }
      }
    };

    // All known native module key names across Expo SDK 48-52
    ensureIsLoaded(NM.ExpoFont);
    ensureIsLoaded(NM.ExpoFontLoader);
    ensureIsLoaded(NM.RNVectorIcons);

    // Also patch via NativeUnimoduleProxy constants table
    try {
      const proxy = NM.NativeUnimoduleProxy;
      if (proxy && proxy.modulesConstantsMap) {
        ensureIsLoaded(proxy.modulesConstantsMap.ExpoFont);
        ensureIsLoaded(proxy.modulesConstantsMap.ExpoFontLoader);
      }
    } catch (_) {}

  } catch (_) {}
})();

// ─── Phase 2: Patch JS-layer expo-font exports ────────────────────────────────
// Each require is isolated so one failure doesn't abort the others.
(function patchExpoFontJS() {

  // 2a — native module proxy wrapper
  try {
    const m = require('expo-font/build/ExpoFont');
    const target = (m && m.default) ? m.default : m;
    if (target && typeof target.isLoadedNative !== 'function') {
      target.isLoadedNative = () => false;
    }
  } catch (_) {}

  // 2b — Font helper (isLoaded calls isLoadedNative internally)
  try {
    const m = require('expo-font/build/Font');
    if (m) {
      if (typeof m.isLoadedNative !== 'function') m.isLoadedNative = () => false;
      if (typeof m.isLoaded !== 'function') m.isLoaded = () => false;
      if (typeof m.loadAsync !== 'function') m.loadAsync = () => Promise.resolve();
    }
  } catch (_) {}

  // 2c — top-level expo-font barrel
  try {
    const m = require('expo-font');
    if (m) {
      if (typeof m.isLoadedNative !== 'function') m.isLoadedNative = () => false;
      if (typeof m.isLoaded !== 'function') m.isLoaded = () => false;
      if (typeof m.loadAsync !== 'function') m.loadAsync = () => Promise.resolve();
    }
  } catch (_) {}

  // 2d — FontLoader (SDK 50+)
  try {
    const m = require('expo-font/build/FontLoader');
    if (m) {
      if (typeof m.isLoadedNative !== 'function') m.isLoadedNative = () => false;
      if (typeof m.isLoaded !== 'function') m.isLoaded = () => false;
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
