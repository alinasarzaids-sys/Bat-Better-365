// index.js — Entry point for Bat Better 365.
//
// PROBLEM: The OnSpace host APK has expo-video compiled natively. When Android
// initialises NativeUnimoduleProxy.getConstants(), expo-video's VideoCache tries to
// open the same SimpleCache folder the host already holds, throwing:
//   "Another SimpleCache instance uses the folder: .../ExpoVideoCache/..."
//
// This exception is thrown SYNCHRONOUSLY at the JNI/Java layer when the
// NativeUnimoduleProxy HostObject getter fires — reading `target[prop]` inside
// a JS Proxy handler is already too late. The only fix is to NEVER read the
// real HostObject for NativeUnimoduleProxy at all — return the stub immediately.

// ─── LAYER 1: Intercept nativeModuleProxy BEFORE any require ─────────────────
(function installNativeModulesProxy() {
  try {
    // Safe stub that satisfies expo-modules-core without touching Java
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

    // Keys that must NEVER delegate to the real HostObject (triggers Java crash)
    var BLOCKED_KEYS = ['NativeUnimoduleProxy'];

    if (global.nativeModuleProxy) {
      try {
        var original = global.nativeModuleProxy;
        var handler = {
          get: function (target, prop) {
            // *** CRITICAL: return stub immediately — do NOT read target[prop] ***
            // Reading target[prop] for NativeUnimoduleProxy fires the JNI call that
            // throws "Another SimpleCache instance" before any try-catch can fire.
            if (BLOCKED_KEYS.indexOf(String(prop)) !== -1) {
              return safeUnimoduleProxy;
            }
            // All other native modules are safe to read normally
            try { return target[prop]; } catch (e) { return undefined; }
          },
          set: function (target, prop, value) {
            try { target[prop] = value; } catch (_) {}
            return true;
          },
          has: function (target, prop) {
            try { return prop in target; } catch (_) { return false; }
          },
        };

        try {
          global.nativeModuleProxy = new Proxy(original, handler);
        } catch (proxyErr) {
          // Hermes always supports Proxy, but if not — directly stub the key
          console.warn('[shim] Proxy unavailable, stubbing directly');
          try { original['NativeUnimoduleProxy'] = safeUnimoduleProxy; } catch (_) {}
        }
      } catch (outerErr) {
        console.warn('[shim] Could not wrap nativeModuleProxy:', String(outerErr).slice(0, 80));
      }
    }

    // Patch react-native NativeModules as a belt-and-suspenders fallback
    // (some paths go through require('react-native').NativeModules instead)
    try {
      var RN = require('react-native');
      if (RN && RN.NativeModules) {
        Object.defineProperty(RN.NativeModules, 'NativeUnimoduleProxy', {
          get: function () { return safeUnimoduleProxy; },
          configurable: true,
          enumerable: true,
        });
      }
    } catch (_) {}

  } catch (topErr) {
    console.warn('[shim] installNativeModulesProxy failed:', String(topErr).slice(0, 80));
  }
})();

// ─── LAYER 2: Global ErrorUtils handler — swallow video cache fatals ──────────
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
          return; // prevent crash
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

// ─── LAYER 4: Load app with crash guard ──────────────────────────────────────
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
    console.warn('[shim] Caught expo-router/entry crash (video cache) — retrying');
    // Hard-stub on NativeModules and retry
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
    throw appLoadErr;
  }
}
