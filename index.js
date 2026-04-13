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
    var stub = {
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
// Now that NativeModules is patched, we can also patch expo-font's exported
// isLoaded function directly so @expo/vector-icons never reaches the native call.
try {
  var expoFont = require('expo-font');
  if (expoFont && typeof expoFont.isLoaded !== 'function') {
    expoFont.isLoaded = function() { return true; };
  }
  // Some versions expose it on the default export
  if (expoFont && expoFont.default && typeof expoFont.default.isLoaded !== 'function') {
    expoFont.default.isLoaded = function() { return true; };
  }
} catch (_) {}

// ─── Entry point ──────────────────────────────────────────────────────────────
// This must be last — it triggers the full app load including expo-router.
require('expo-router/entry');
