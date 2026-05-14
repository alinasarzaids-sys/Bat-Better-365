// index.js — Entry point for Bat Better 365.
//
// PROBLEM: The OnSpace host APK has expo-video compiled natively. When Android
// initialises NativeUnimoduleProxy.getConstants(), expo-video's VideoCache tries to
// open the same SimpleCache folder the host already holds, throwing:
//   "Another SimpleCache instance uses the folder: .../ExpoVideoCache/..."
//
// This exception is thrown SYNCHRONOUSLY during metroRequire() at the JNI/Java layer
// when the NativeUnimoduleProxy HostObject getter fires — before our JS try-catch can
// wrap it. The only reliable fix is to:
//   1. Intercept nativeModuleProxy at the JS Object level via defineProperty
//   2. Return a safe stub for NativeUnimoduleProxy without ever calling into Java
//   3. Wrap require('expo-router/entry') in a try-catch as final safety net
//   4. Install an ErrorUtils global handler to swallow any async re-throws

// ─── LAYER 1: Intercept nativeModuleProxy HostObject BEFORE any require ──────
// The crash fires when JS first reads `global.nativeModuleProxy.NativeUnimoduleProxy`
// (in expo-modules-core). We shadow the global with a JS Proxy that intercepts that
// specific property and returns a safe stub instead of delegating to the Java layer.
(function installNativeModulesProxy() {
  try {
    var safeUnimoduleProxy = {
      modulesConstants: {},
      exportedMethods: {},
      viewManagersNames: [],
      getConstants: function () {
        return { modulesConstants: {}, exportedMethods: {}, viewManagersNames: [] };
      },
      callMethod: function () { return Promise.resolve(null); },
      addListener: function () {},
      removeListeners: function () {},
    };

    var VIDEO_CRASH_KEYS = [
      'NativeUnimoduleProxy',
    ];

    // Only intercept if the native module proxy actually exists
    if (global.nativeModuleProxy) {
      try {
        var original = global.nativeModuleProxy;
        var handler = {
          get: function (target, prop) {
            if (VIDEO_CRASH_KEYS.indexOf(String(prop)) !== -1) {
              // Try fetching from real proxy; if it crashes, return stub
              try {
                var val = target[prop];
                // Also try calling getConstants to surface crash now, in our scope
                if (val && typeof val.getConstants === 'function') {
                  try { val.getConstants(); } catch (_innerCrash) {
                    console.warn('[shim] NativeUnimoduleProxy.getConstants crashed — using stub');
                    return safeUnimoduleProxy;
                  }
                }
                return val;
              } catch (e) {
                console.warn('[shim] nativeModuleProxy["' + String(prop) + '"] crashed — using stub:', String(e).slice(0, 100));
                return safeUnimoduleProxy;
              }
            }
            try { return target[prop]; } catch (e2) { return undefined; }
          },
          set: function (target, prop, value) {
            try { target[prop] = value; } catch (_) {}
            return true;
          },
        };

        try {
          // Replace the HostObject reference with a JS Proxy
          global.nativeModuleProxy = new Proxy(original, handler);
        } catch (proxyErr) {
          // Proxy not available (very old JSC) — fall back to direct stub insertion
          console.warn('[shim] Proxy unavailable, trying direct stub:', String(proxyErr).slice(0, 60));
          try { original['NativeUnimoduleProxy'] = safeUnimoduleProxy; } catch (_) {}
        }
      } catch (outerErr) {
        console.warn('[shim] Could not wrap nativeModuleProxy:', String(outerErr).slice(0, 60));
      }
    }

    // Also patch react-native's NativeModules after it loads
    try {
      var RN = require('react-native');
      if (RN && RN.NativeModules && !RN.NativeModules.NativeUnimoduleProxy) {
        Object.defineProperty(RN.NativeModules, 'NativeUnimoduleProxy', {
          get: function () { return safeUnimoduleProxy; },
          configurable: true,
        });
      }
    } catch (_) {}

  } catch (topErr) {
    console.warn('[shim] installNativeModulesProxy failed:', String(topErr).slice(0, 80));
  }
})();

// ─── LAYER 2: ErrorUtils global handler ─────────────────────────────────────
(function installErrorHandler() {
  try {
    var ErrorUtils = global.ErrorUtils;
    if (ErrorUtils) {
      var _originalHandler = ErrorUtils.getGlobalHandler();
      ErrorUtils.setGlobalHandler(function (error, isFatal) {
        var msg = error ? (error.message || String(error)) : '';
        var isVideoCacheError =
          msg.indexOf('SimpleCache') !== -1 ||
          msg.indexOf('ExpoVideoCache') !== -1 ||
          msg.indexOf('NativeUnimoduleProxy') !== -1 ||
          msg.indexOf('Another SimpleCache') !== -1 ||
          msg.indexOf('VideoCache') !== -1 ||
          msg.indexOf('has not been registered') !== -1 ||
          msg.indexOf('Exception in HostObject') !== -1;

        if (isVideoCacheError) {
          console.warn('[shim] Swallowed video cache error:', msg.slice(0, 120));
          return; // do NOT crash the app
        }
        if (_originalHandler) {
          _originalHandler(error, isFatal);
        }
      });
    }
  } catch (_) {}
})();

// ─── LAYER 3: LogBox suppression ─────────────────────────────────────────────
(function suppressLogs() {
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
})();

// ─── LAYER 4: Load app with top-level crash guard ───────────────────────────
try {
  require('expo-router/entry');
} catch (appLoadErr) {
  var msg = appLoadErr ? (appLoadErr.message || String(appLoadErr)) : '';
  var isKnownCrash =
    msg.indexOf('SimpleCache') !== -1 ||
    msg.indexOf('NativeUnimoduleProxy') !== -1 ||
    msg.indexOf('ExpoVideoCache') !== -1 ||
    msg.indexOf('Exception in HostObject') !== -1;

  if (isKnownCrash) {
    console.warn('[shim] Caught expo-router/entry crash (video cache) — retrying bare entry');
    // Install a hard stub on react-native's NativeModules and retry
    try {
      var RN2 = require('react-native');
      if (RN2 && RN2.NativeModules) {
        RN2.NativeModules.NativeUnimoduleProxy = {
          modulesConstants: {},
          exportedMethods: {},
          viewManagersNames: [],
          getConstants: function () { return { modulesConstants: {}, exportedMethods: {}, viewManagersNames: [] }; },
          callMethod: function () { return Promise.resolve(null); },
          addListener: function () {},
          removeListeners: function () {},
        };
      }
    } catch (_) {}
    try {
      require('expo-router/entry');
    } catch (retryErr) {
      console.error('[shim] Retry also failed:', String(retryErr).slice(0, 200));
    }
  } else {
    // Real app error — re-throw so it surfaces properly
    throw appLoadErr;
  }
}
