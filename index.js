// index.js — Clean entry point.
// All @expo/vector-icons usage has been replaced with SafeIcon (pure-JS Text renderer),
// so no native font patching is needed.

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

require('expo-router/entry');
