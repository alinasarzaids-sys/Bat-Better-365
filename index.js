// ─── Silence known container warnings ────────────────────────────────────────
import { LogBox } from 'react-native';
LogBox.ignoreLogs([
  'Another SimpleCache instance',
  'ExpoVideoCache',
  'NativeUnimoduleProxy',
  'Exception in HostObject::get for prop',
  'SimpleCache',
]);

// ─── Phase 1: Stub NativeModules font entries BEFORE any module loads ─────────
// This must run before expo-font evaluates its module. The OnSpace Android
// container may have a sealed/native-proxy NativeModules object where plain
// property assignment silently fails. We use Object.defineProperty to force it.
(function patchNativeModulesFonts() {
  try {
    const { NativeModules } = require('react-native');
    if (!NativeModules) return;

    // A safe stub: isLoadedNative returns false so expo-font falls back to JS
    const stub = {
      isLoadedNative: function() { return false; },
      isLoaded: function() { return true; },
      getLoadedFonts: function() { return []; },
      loadAsync: function() { return Promise.resolve(); },
      unloadAllAsync: function() { return Promise.resolve(); },
    };

    // Force-write a property even on sealed/native-proxy objects
    function forceDefine(obj, key, value) {
      if (!obj || typeof obj !== 'object') return;
      try {
        // Plain assignment first
        obj[key] = value;
        // If the assignment didn't stick, use defineProperty
        if (obj[key] !== value) {
          Object.defineProperty(obj, key, {
            value: value,
            writable: true,
            configurable: true,
            enumerable: true,
          });
        }
      } catch (_a) {
        try {
          Object.defineProperty(obj, key, {
            value: value,
            writable: true,
            configurable: true,
            enumerable: true,
          });
        } catch (_b) {
          // silently swallow — cannot patch this container
        }
      }
    }

    // Ensure each font-related native module key exists and has valid functions
    ['ExpoFont', 'ExpoFontLoader', 'RNVectorIcons'].forEach(function(key) {
      var existing = NativeModules[key];
      if (!existing || typeof existing !== 'object') {
        // Module missing entirely — create a full stub
        forceDefine(NativeModules, key, Object.assign({}, stub));
      } else {
        // Module exists but individual methods may be missing or broken
        if (typeof existing.isLoadedNative !== 'function') {
          forceDefine(existing, 'isLoadedNative', stub.isLoadedNative);
        }
        if (typeof existing.isLoaded !== 'function') {
          forceDefine(existing, 'isLoaded', stub.isLoaded);
        }
        if (typeof existing.getLoadedFonts !== 'function') {
          forceDefine(existing, 'getLoadedFonts', stub.getLoadedFonts);
        }
        if (typeof existing.loadAsync !== 'function') {
          forceDefine(existing, 'loadAsync', stub.loadAsync);
        }
      }
    });

    // Also patch NativeUnimoduleProxy constants map (SDK 48 compat layer)
    try {
      var proxy = NativeModules.NativeUnimoduleProxy;
      if (proxy && proxy.modulesConstantsMap) {
        ['ExpoFont', 'ExpoFontLoader'].forEach(function(key) {
          if (!proxy.modulesConstantsMap[key]) {
            forceDefine(proxy.modulesConstantsMap, key, Object.assign({}, stub));
          }
        });
      }
    } catch (_) {}

  } catch (_) {
    // If even require('react-native') fails, nothing we can do — let the app crash naturally
  }
})();

// ─── Entry point ──────────────────────────────────────────────────────────────
import 'expo-router/entry';
