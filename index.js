import { LogBox, AppRegistry } from 'react-native';

// Suppress known warnings from the OnSpace container environment.
LogBox.ignoreLogs([
  'Another SimpleCache instance',
  'ExpoVideoCache',
  'NativeUnimoduleProxy',
  'Exception in HostObject::get for prop',
  'SimpleCache',
]);

// Patch: intercept the NativeUnimoduleProxy error that expo-video triggers
// when running inside the OnSpace app container (which already holds an
// ExpoVideoCache SimpleCache lock on the same folder).  Without this guard
// the error propagates before AppRegistry.registerComponent is called,
// which produces the "main has not been registered" crash.
try {
  const { NativeModules } = require('react-native');
  if (NativeModules && NativeModules.NativeUnimoduleProxy) {
    const original = Object.getOwnPropertyDescriptor(NativeModules, 'NativeUnimoduleProxy');
    // Access once to trigger any pending initialisation; catch silently if it
    // throws so the rest of the bundle continues loading.
    try { void NativeModules.NativeUnimoduleProxy; } catch (_) {}
  }
} catch (_) {}

import 'expo-router/entry';
