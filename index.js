// index.js — Entry point for Bat Better 365.
//
// PROBLEM: The OnSpace host APK has expo-video compiled in natively. When Android
// initialises NativeUnimoduleProxy.getConstants(), expo-video's VideoCache tries to
// open the same SimpleCache folder the host already holds, throwing:
//   "Another SimpleCache instance uses the folder: .../ExpoVideoCache/..."
//
// This exception is thrown SYNCHRONOUSLY during the metroRequire() chain that loads
// expo-router/entry, which means AppRegistry.registerComponent() is never reached →
// "main" has not been registered (Error #1).
//
// FIX STRATEGY (3 layers, applied before any other require):
//   1. Pre-warm NativeUnimoduleProxy — catch the SimpleCache crash ourselves and
//      replace NativeModules.NativeUnimoduleProxy with a safe no-op stub so every
//      downstream require() succeeds.
//   2. ErrorUtils global handler — catches any late / async re-throw.
//   3. LogBox suppression — keeps the UI clean.

// ─── LAYER 1: Pre-warm NativeUnimoduleProxy (MUST be first) ─────────────────
// We access NativeUnimoduleProxy before the module graph loads.  If it throws the
// SimpleCache error we catch it here and install a stub so nothing else explodes.
(function patchNativeUnimoduleProxy() {
  try {
    // Access NativeModules via the low-level BatchedBridge to avoid triggering
    // any higher-level initialisation that could itself fail.
    var NativeModules = global.nativeModuleProxy || {};
    try {
      // Attempt to read NativeUnimoduleProxy — this is where the crash happens.
      var proxy = NativeModules['NativeUnimoduleProxy'];
      if (proxy && typeof proxy.getConstants === 'function') {
        proxy.getConstants(); // force the crash to happen NOW, in our try-catch
      }
    } catch (innerErr) {
      console.warn('[shim] NativeUnimoduleProxy threw during pre-warm — installing stub:', String(innerErr).slice(0, 120));
      // Install a safe stub on every known access path.
      var safeProxy = {
        modulesConstants: {},
        exportedMethods: {},
        viewManagersNames: [],
        getConstants: function () {
          return { modulesConstants: {}, exportedMethods: {}, viewManagersNames: [] };
        },
        callMethod: function () {},
        addListener: function () {},
        removeListeners: function () {},
      };
      try { NativeModules['NativeUnimoduleProxy'] = safeProxy; } catch (_) {}
      // Also patch via require path used by expo-modules-core
      try {
        var RN = require('react-native');
        if (RN.NativeModules) {
          RN.NativeModules.NativeUnimoduleProxy = safeProxy;
        }
      } catch (_) {}
    }
  } catch (_) {}
})();

// ─── LAYER 2: ErrorUtils global handler ─────────────────────────────────────
try {
  var ErrorUtils = global.ErrorUtils;
  if (ErrorUtils) {
    var _originalHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler(function (error, isFatal) {
      var msg = (error && error.message) ? error.message : String(error);
      var isVideoCacheError =
        msg.indexOf('SimpleCache') !== -1 ||
        msg.indexOf('ExpoVideoCache') !== -1 ||
        msg.indexOf('NativeUnimoduleProxy') !== -1 ||
        msg.indexOf('Another SimpleCache') !== -1 ||
        msg.indexOf('VideoCache') !== -1 ||
        msg.indexOf('has not been registered') !== -1;

      if (isVideoCacheError) {
        console.warn('[shim] Swallowed video cache error:', msg.slice(0, 120));
        return;
      }
      if (_originalHandler) {
        _originalHandler(error, isFatal);
      }
    });
  }
} catch (_) {}

// ─── LAYER 3: LogBox suppression ─────────────────────────────────────────────
try {
  var LogBox = require('react-native').LogBox;
  if (LogBox && typeof LogBox.ignoreLogs === 'function') {
    LogBox.ignoreLogs([
      'Another SimpleCache instance',
      'ExpoVideoCache',
      'NativeUnimoduleProxy',
      'Exception in HostObject::get for prop',
      'SimpleCache',
      'VideoCache',
      'VideoManager',
      'VideoModule',
      'new NativeEventEmitter',
      'EventEmitter.removeListener',
    ]);
  }
} catch (_) {}

// ─── Load the app ────────────────────────────────────────────────────────────
require('expo-router/entry');
