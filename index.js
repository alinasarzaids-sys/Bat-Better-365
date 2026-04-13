// ─── Phase 1: Stub NativeModules font entries BEFORE any module loads ─────────
// CRITICAL: This file must use only require() calls, never ES import statements.
// ES `import` is hoisted by Babel/Metro and executes BEFORE any code in the
// module body, which would cause expo-router/entry to load and evaluate
// expo-font BEFORE our patches run. require() calls are NOT hoisted and execute
// in the order they appear.

(function patchNativeModulesFonts() {
  try {
    var RN = require('react-native');
    var NativeModules = RN.NativeModules;
    if (!NativeModules) return;

    // Safe stub: isLoadedNative returns false so expo-font falls back to JS checks
    var fontStub = {
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
        obj[key] = value;
        if (obj[key] !== value) {
          Object.defineProperty(obj, key, {
            value: value, writable: true, configurable: true, enumerable: true,
          });
        }
      } catch (_a) {
        try {
          Object.defineProperty(obj, key, {
            value: value, writable: true, configurable: true, enumerable: true,
          });
        } catch (_b) { /* cannot patch this property */ }
      }
    }

    // Ensure each font-related native module key exists and has valid functions
    ['ExpoFont', 'ExpoFontLoader', 'RNVectorIcons'].forEach(function(key) {
      var existing = NativeModules[key];
      if (!existing || typeof existing !== 'object') {
        forceDefine(NativeModules, key, {
          isLoadedNative: function() { return false; },
          isLoaded: function() { return true; },
          getLoadedFonts: function() { return []; },
          loadAsync: function() { return Promise.resolve(); },
          unloadAllAsync: function() { return Promise.resolve(); },
        });
      } else {
        // Always overwrite these — they may be present but broken
        forceDefine(existing, 'isLoadedNative', function() { return false; });
        forceDefine(existing, 'isLoaded', function() { return true; });
        forceDefine(existing, 'getLoadedFonts', function() { return []; });
        if (typeof existing.loadAsync !== 'function') {
          forceDefine(existing, 'loadAsync', function() { return Promise.resolve(); });
        }
      }
    });

    // Also patch NativeUnimoduleProxy constants map (SDK 48 compat layer)
    try {
      var proxy = NativeModules.NativeUnimoduleProxy;
      if (proxy && proxy.modulesConstantsMap) {
        ['ExpoFont', 'ExpoFontLoader'].forEach(function(key) {
          if (!proxy.modulesConstantsMap[key]) {
            forceDefine(proxy.modulesConstantsMap, key, {
              isLoadedNative: function() { return false; },
              isLoaded: function() { return true; },
              getLoadedFonts: function() { return []; },
            });
          }
        });
      }
    } catch (_) {}

  } catch (_) {
    // If even require('react-native') fails, nothing we can do
  }
})();

// ─── Phase 2: Silence known container warnings ────────────────────────────────
try {
  var LogBox = require('react-native').LogBox;
  if (LogBox && typeof LogBox.ignoreLogs === 'function') {
    LogBox.ignoreLogs([
      'Another SimpleCache instance',
      'ExpoVideoCache',
      'NativeUnimoduleProxy',
      'Exception in HostObject::get for prop',
      'SimpleCache',
    ]);
  }
} catch (_) {}

// ─── Phase 3: Patch expo-font's isLoaded at module level ─────────────────────
// CRITICAL FIX: Always overwrite isLoaded (and isLoadedNative) unconditionally.
// The previous bug: we only patched if `typeof isLoaded !== 'function'` — but
// isLoaded IS a function, just one that internally calls the broken native
// isLoadedNative. We must replace it with a safe version that never reaches
// the native layer.
try {
  var expoFont = require('expo-font');
  if (expoFont) {
    // Always overwrite — even if it's already a function it may be broken
    var safeIsLoaded = function() { return true; };
    var safeIsLoadedNative = function() { return false; };

    try { expoFont.isLoaded = safeIsLoaded; } catch (_) {}
    try { expoFont.isLoadedNative = safeIsLoadedNative; } catch (_) {}

    try {
      Object.defineProperty(expoFont, 'isLoaded', {
        value: safeIsLoaded, writable: true, configurable: true, enumerable: true,
      });
    } catch (_) {}
    try {
      Object.defineProperty(expoFont, 'isLoadedNative', {
        value: safeIsLoadedNative, writable: true, configurable: true, enumerable: true,
      });
    } catch (_) {}

    // Patch the default export too (some bundler versions expose it differently)
    if (expoFont.default) {
      try { expoFont.default.isLoaded = safeIsLoaded; } catch (_) {}
      try { expoFont.default.isLoadedNative = safeIsLoadedNative; } catch (_) {}
    }
  }
} catch (_) {}

// ─── Entry point ──────────────────────────────────────────────────────────────
// This must be last — it triggers the full app load including expo-router.
require('expo-router/entry');
