// index.js — Entry point for Bat Better 365.
// expo-video is stubbed via metro.config.js to prevent Android SimpleCache conflicts.
// The native expo-video module (compiled into the OnSpace host APK) tries to open
// the same SimpleCache folder, causing "Another SimpleCache instance" errors.
// We suppress these at every available layer below.

// ─── 1. Suppress LogBox warnings (UI layer) ─────────────────────────────────
try {
  var LogBox = require('react-native').LogBox;
  if (LogBox && typeof LogBox.ignoreLogs === 'function') {
    LogBox.ignoreLogs([
      'Another SimpleCache instance',
      'ExpoVideoCache',
      'NativeUnimoduleProxy',
      'Exception in HostObject::get for prop',
      'SimpleCache',
      'new NativeEventEmitter',
      'EventEmitter.removeListener',
      'VideoCache',
      'VideoManager',
      'VideoModule',
    ]);
  }
} catch (_) {}

// ─── 2. Override global error handler to swallow expo-video SimpleCache errors ─
try {
  var ErrorUtils = global.ErrorUtils;
  if (ErrorUtils) {
    var originalHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler(function (error, isFatal) {
      var msg = (error && error.message) ? error.message : String(error);
      var isVideoCacheError =
        msg.indexOf('SimpleCache') !== -1 ||
        msg.indexOf('ExpoVideoCache') !== -1 ||
        msg.indexOf('NativeUnimoduleProxy') !== -1 ||
        msg.indexOf('Another SimpleCache') !== -1 ||
        msg.indexOf('VideoCache') !== -1;

      if (isVideoCacheError) {
        // Swallow — don't crash the app for this native module conflict
        console.warn('[expo-video shim] Swallowed SimpleCache conflict:', msg);
        return;
      }

      if (originalHandler) {
        originalHandler(error, isFatal);
      }
    });
  }
} catch (_) {}

// ─── 3. Load the app ─────────────────────────────────────────────────────────
require('expo-router/entry');
