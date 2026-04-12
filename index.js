import { LogBox } from 'react-native';

// Suppress known warnings from the OnSpace container environment.
LogBox.ignoreLogs([
  'Another SimpleCache instance',
  'ExpoVideoCache',
  'NativeUnimoduleProxy',
  'Exception in HostObject::get for prop',
  'SimpleCache',
]);

// Patch 1: Guard NativeUnimoduleProxy access so expo-video's SimpleCache
// conflict does not prevent AppRegistry.registerComponent from running.
try {
  const { NativeModules } = require('react-native');
  if (NativeModules) {
    try { void NativeModules.NativeUnimoduleProxy; } catch (_) {}
  }
} catch (_) {}

// Patch 2: expo-font's isLoadedNative binding can be undefined inside the
// OnSpace Android container (the NativeUnimoduleProxy may not expose the
// ExpoFont.isLoadedNative method).  When MaterialIcons calls Font.isLoaded()
// it invokes isLoadedNative() directly — if that value is undefined the call
// throws "TypeError: undefined is not a function" and crashes the entire tree.
//
// Fix: find the ExpoFont native module through every known path and ensure
// isLoadedNative is at least a no-op that returns false, which causes
// expo-font to fall back to its JS-side font registry check instead.
try {
  const { NativeModules } = require('react-native');

  // Path A — direct NativeModules.ExpoFont (new arch)
  const directFont = NativeModules && NativeModules.ExpoFont;
  if (directFont && typeof directFont.isLoadedNative !== 'function') {
    directFont.isLoadedNative = () => false;
  }

  // Path B — via NativeUnimoduleProxy.callMethod shim (old arch)
  const proxy = NativeModules && NativeModules.NativeUnimoduleProxy;
  if (proxy) {
    // The proxy exposes each module's methods as properties on the constants
    // object.  If the font method table entry is missing we cannot patch it
    // there, but we can intercept at the expo-font JS layer instead.
    try {
      // Require expo-font's internal module object and patch the function.
      const ExpoFont = require('expo-font/build/ExpoFont').default ||
                       require('expo-font/build/ExpoFont');
      if (ExpoFont && typeof ExpoFont.isLoadedNative !== 'function') {
        ExpoFont.isLoadedNative = () => false;
      }
    } catch (_) {}
  }

  // Path C — patch the expo-font Font module's isLoadedNative reference
  // directly so that even if the native binding arrives late (or not at all)
  // the exported helper always returns a boolean instead of crashing.
  try {
    const FontModule = require('expo-font/build/Font');
    if (FontModule && typeof FontModule.isLoadedNative !== 'function') {
      FontModule.isLoadedNative = () => false;
    }
  } catch (_) {}

} catch (_) {}

import 'expo-router/entry';
