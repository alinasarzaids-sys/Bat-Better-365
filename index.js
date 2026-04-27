// index.js — Clean entry point for Bat Better 365.
// expo-video is stubbed via metro.config.js to prevent the Android
// SimpleCache conflict that crashes the app before JS can register.

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
    ]);
  }
} catch (_) {}

require('expo-router/entry');
