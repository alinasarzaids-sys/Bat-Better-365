// ─── Silence known container warnings ────────────────────────────────────────
import { LogBox } from 'react-native';
LogBox.ignoreLogs([
  'Another SimpleCache instance',
  'ExpoVideoCache',
  'NativeUnimoduleProxy',
  'Exception in HostObject::get for prop',
  'SimpleCache',
]);

// ─── Phase 1: Force-define NativeModules entries via Object.defineProperty ───
// Plain assignment (`NM.ExpoFont = {}`) silently fails on sealed/native-proxy
// NativeModules objects in the OnSpace Android container.
// Object.defineProperty with configurable:true forces the override.
(function patchNativeModules() {
  try {
    const RN = require('react-native');
    const NM = RN && RN.NativeModules;
    if (!NM) return;

    const fontStub = {
      isLoadedNative: function () { return false; },
      isLoaded: function () { return false; },
      getLoadedFonts: function () { return []; },
      loadAsync: function () { return Promise.resolve(); },
      unloadAllAsync: function () { return Promise.resolve(); },
    };

    const forceSet = (obj, key, value) => {
      try {
        // Try plain assignment first
        obj[key] = value;
        // If it still didn't take (native proxy), force it
        if (obj[key] !== value) {
          Object.defineProperty(obj, key, {
            value,
            writable: true,
            configurable: true,
            enumerable: true,
          });
        }
      } catch (e1) {
        try {
          Object.defineProperty(obj, key, {
            value,
            writable: true,
            configurable: true,
            enumerable: true,
          });
        } catch (_) {}
      }
    };

    const patchModule = (mod) => {
      if (!mod || typeof mod !== 'object') return;
      if (typeof mod.isLoadedNative !== 'function') forceSet(mod, 'isLoadedNative', fontStub.isLoadedNative);
      if (typeof mod.isLoaded !== 'function') forceSet(mod, 'isLoaded', fontStub.isLoaded);
      if (typeof mod.getLoadedFonts !== 'function') forceSet(mod, 'getLoadedFonts', fontStub.getLoadedFonts);
      if (typeof mod.loadAsync !== 'function') forceSet(mod, 'loadAsync', fontStub.loadAsync);
    };

    // Force-define the font module entries even if NM is a native proxy
    ['ExpoFont', 'ExpoFontLoader', 'RNVectorIcons'].forEach(key => {
      if (!NM[key] || typeof NM[key] !== 'object') {
        forceSet(NM, key, Object.assign({}, fontStub));
      } else {
        patchModule(NM[key]);
      }
    });

    // NativeUnimoduleProxy constants table (SDK 48 compatibility)
    try {
      const proxy = NM.NativeUnimoduleProxy;
      if (proxy && proxy.modulesConstantsMap) {
        ['ExpoFont', 'ExpoFontLoader'].forEach(key => {
          if (!proxy.modulesConstantsMap[key]) {
            forceSet(proxy.modulesConstantsMap, key, Object.assign({}, fontStub));
          }
          patchModule(proxy.modulesConstantsMap[key]);
        });
      }
    } catch (_) {}

  } catch (_) {}
})();

// ─── Phase 2: Patch expo-font JS modules — use defineProperty on exports ─────
// `m.isLoaded = fn` can fail if the module object is sealed (Object.freeze).
// We use defineProperty to force-write properties on frozen module exports too.
(function patchExpoFontJS() {

  const forceWrite = (obj, key, val) => {
    if (!obj || typeof obj !== 'object') return;
    try {
      obj[key] = val;
      if (obj[key] !== val) throw new Error('assignment failed');
    } catch (_) {
      try {
        Object.defineProperty(obj, key, { value: val, writable: true, configurable: true });
      } catch (__) {}
    }
  };

  // 2a — ExpoFont native proxy wrapper
  try {
    const m = require('expo-font/build/ExpoFont');
    const target = (m && m.default) ? m.default : m;
    if (target) {
      forceWrite(target, 'isLoadedNative', () => false);
      forceWrite(target, 'getLoadedFonts', () => []);
      forceWrite(target, 'loadAsync', () => Promise.resolve());
    }
  } catch (_) {}

  // 2b — Font module: isLoaded returns TRUE so Icon never reaches isLoadedNative
  try {
    const m = require('expo-font/build/Font');
    if (m) {
      forceWrite(m, 'isLoadedNative', () => false);
      forceWrite(m, 'isLoaded', () => true);
      forceWrite(m, 'loadAsync', () => Promise.resolve());
    }
  } catch (_) {}

  // 2c — top-level expo-font barrel
  try {
    const m = require('expo-font');
    if (m) {
      forceWrite(m, 'isLoadedNative', () => false);
      forceWrite(m, 'isLoaded', () => true);
      forceWrite(m, 'loadAsync', () => Promise.resolve());
    }
  } catch (_) {}

  // 2d — FontLoader (SDK 50+)
  try {
    const m = require('expo-font/build/FontLoader');
    if (m) {
      forceWrite(m, 'isLoadedNative', () => false);
      forceWrite(m, 'isLoaded', () => true);
    }
  } catch (_) {}

})();

// ─── Phase 3: Intercept @expo/vector-icons Icon at its source ────────────────
// Even after patching exported `isLoaded`, vector-icons may hold a direct
// closure reference to the old function. We intercept the Icon class's
// `_getIconStyle` / render to swallow the crash as a last resort.
(function patchVectorIcons() {
  try {
    // Patch the underlying createIconSet factory result
    const factory = require('@expo/vector-icons/build/vendor/react-native-vector-icons/lib/create-icon-set');
    const orig = (factory && factory.default) ? factory.default : factory;
    if (typeof orig === 'function') {
      const wrap = function (...args) {
        const Component = orig(...args);
        // Wrap the isLoaded check used inside the component
        try {
          if (Component && Component.prototype && Component.prototype.render) {
            const origRender = Component.prototype.render;
            Component.prototype.render = function () {
              try { return origRender.call(this); } catch (_) { return null; }
            };
          }
        } catch (_) {}
        return Component;
      };
      if (factory && factory.default) factory.default = wrap;
    }
  } catch (_) {}
})();

// ─── Phase 4: Guard AppRegistry ──────────────────────────────────────────────
(function guardAppRegistry() {
  try {
    const { AppRegistry } = require('react-native');
    if (AppRegistry) {
      const orig = AppRegistry.registerComponent;
      AppRegistry.registerComponent = function (name, componentProvider) {
        try { return orig.call(AppRegistry, name, componentProvider); }
        catch (err) { console.warn('[index.js] registerComponent failed:', err); }
      };
    }
  } catch (_) {}
})();

// ─── Entry point ──────────────────────────────────────────────────────────────
import 'expo-router/entry';
