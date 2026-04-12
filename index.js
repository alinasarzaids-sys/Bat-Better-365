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
// OnSpace Android container. When MaterialIcons calls Font.isLoaded() it
// invokes isLoadedNative() — if undefined the call crashes the entire tree.
//
// Strategy: patch every known native module key AND every JS-layer export
// path before the module graph resolves, ensuring no undefined call site.
try {
  const { NativeModules } = require('react-native');

  // Helper: ensure isLoadedNative is always a callable on a module object
  const ensureFn = (mod) => {
    if (mod && typeof mod.isLoadedNative !== 'function') {
      mod.isLoadedNative = () => false;
    }
  };

  // Native module key variants (Expo SDK 49-52 use different names)
  if (NativeModules) {
    ensureFn(NativeModules.ExpoFont);        // SDK <= 49
    ensureFn(NativeModules.ExpoFontLoader);  // SDK 50+
    ensureFn(NativeModules.RNVectorIcons);   // react-native-vector-icons shim
    // Also patch the proxy constants table if it exists
    const proxy = NativeModules.NativeUnimoduleProxy;
    if (proxy && proxy.modulesConstantsMap) {
      try {
        const fontConsts = proxy.modulesConstantsMap.ExpoFont ||
                           proxy.modulesConstantsMap.ExpoFontLoader;
        if (fontConsts) ensureFn(fontConsts);
      } catch (_) {}
    }
  }

  // JS layer — expo-font/build/ExpoFont (the native module proxy wrapper)
  try {
    const m = require('expo-font/build/ExpoFont');
    ensureFn(m && m.default ? m.default : m);
  } catch (_) {}

  // JS layer — expo-font/build/Font (the public isLoaded helper)
  try {
    const m = require('expo-font/build/Font');
    if (m && typeof m.isLoadedNative !== 'function') {
      m.isLoadedNative = () => false;
    }
    // Also patch the module-level isLoaded to short-circuit native call
    if (m && typeof m.isLoaded !== 'function') {
      m.isLoaded = () => false;
    }
  } catch (_) {}

  // JS layer — expo-font top-level export
  try {
    const m = require('expo-font');
    if (m && typeof m.isLoadedNative !== 'function') {
      m.isLoadedNative = () => false;
    }
  } catch (_) {}

} catch (_) {}

import 'expo-router/entry';
