// ─── Phase 1: Stub NativeModules font entries BEFORE any module loads ─────────
// CRITICAL: Only require() calls here — ES `import` is hoisted by Babel/Metro
// and executes BEFORE any code in the module body, so patches would run too late.

(function patchNativeModulesFonts() {
  try {
    var RN = require('react-native');
    var NativeModules = RN.NativeModules;
    if (!NativeModules) return;

    function forceDefine(obj, key, value) {
      if (!obj || typeof obj !== 'object') return;
      try { obj[key] = value; } catch (_) {}
      try {
        if (obj[key] !== value) {
          Object.defineProperty(obj, key, {
            value: value, writable: true, configurable: true, enumerable: true,
          });
        }
      } catch (_) {}
    }

    ['ExpoFont', 'ExpoFontLoader', 'RNVectorIcons'].forEach(function(key) {
      var existing = NativeModules[key];
      if (!existing || typeof existing !== 'object') {
        forceDefine(NativeModules, key, {
          isLoadedNative: function() { return false; },
          isLoaded: function() { return true; },
          getLoadedFonts: function() { return []; },
          loadAsync: function() { return Promise.resolve(); },
          unloadAllAsync: function() { return Promise.resolve(); },
        });
      } else {
        forceDefine(existing, 'isLoadedNative', function() { return false; });
        forceDefine(existing, 'isLoaded', function() { return true; });
        forceDefine(existing, 'getLoadedFonts', function() { return []; });
        if (typeof existing.loadAsync !== 'function') {
          forceDefine(existing, 'loadAsync', function() { return Promise.resolve(); });
        }
      }
    });

    try {
      var proxy = NativeModules.NativeUnimoduleProxy;
      if (proxy && proxy.modulesConstantsMap) {
        ['ExpoFont', 'ExpoFontLoader'].forEach(function(key) {
          if (!proxy.modulesConstantsMap[key]) {
            forceDefine(proxy.modulesConstantsMap, key, {
              isLoadedNative: function() { return false; },
              isLoaded: function() { return true; },
              getLoadedFonts: function() { return []; },
            });
          }
        });
      }
    } catch (_) {}

  } catch (_) {}
})();

// ─── Phase 2: Silence known container warnings ────────────────────────────────
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

// ─── Phase 3: Patch expo-font isLoaded / isLoadedNative unconditionally ───────
try {
  var expoFont = require('expo-font');
  if (expoFont) {
    var safeIsLoaded = function() { return true; };
    var safeIsLoadedNative = function() { return false; };

    try { expoFont.isLoaded = safeIsLoaded; } catch (_) {}
    try { expoFont.isLoadedNative = safeIsLoadedNative; } catch (_) {}
    try {
      Object.defineProperty(expoFont, 'isLoaded', {
        value: safeIsLoaded, writable: true, configurable: true, enumerable: true,
      });
    } catch (_) {}
    try {
      Object.defineProperty(expoFont, 'isLoadedNative', {
        value: safeIsLoadedNative, writable: true, configurable: true, enumerable: true,
      });
    } catch (_) {}
    if (expoFont.default) {
      try { expoFont.default.isLoaded = safeIsLoaded; } catch (_) {}
      try { expoFont.default.isLoadedNative = safeIsLoadedNative; } catch (_) {}
    }
  }
} catch (_) {}

// ─── Phase 4: Wrap Icon.prototype.render to swallow isLoadedNative crashes ────
// ROOT CAUSE: Icon is a class component that captured its own closure reference
// to the internal isLoaded/isLoadedNative functions at module evaluation time.
// Patching expoFont.isLoaded AFTER the module loaded doesn't update those
// captured references. The only guaranteed fix is to wrap the class render()
// method itself in a try-catch so crashes inside it return null instead of
// propagating up and crashing the entire React tree.
(function patchVectorIconsRender() {
  try {
    var vectorIcons = require('@expo/vector-icons');
    if (!vectorIcons) return;

    // Get all icon set classes exported from the package
    var iconSets = ['MaterialIcons', 'MaterialCommunityIcons', 'Ionicons', 'FontAwesome',
      'FontAwesome5', 'AntDesign', 'Entypo', 'EvilIcons', 'Feather', 'Foundation',
      'Octicons', 'SimpleLineIcons', 'Zocial'];

    iconSets.forEach(function(name) {
      try {
        var IconClass = vectorIcons[name];
        if (!IconClass) return;

        // Walk the prototype chain to find the render method
        var proto = IconClass.prototype;
        if (!proto) return;

        // Patch render if it exists on this prototype
        if (typeof proto.render === 'function' && !proto.__iconRenderPatched) {
          var originalRender = proto.render;
          proto.render = function() {
            try {
              return originalRender.apply(this, arguments);
            } catch (e) {
              // isLoadedNative crash — return null to avoid tree crash
              return null;
            }
          };
          proto.__iconRenderPatched = true;
        }

        // Also patch the class's own render if different from prototype
        if (typeof IconClass.render === 'function' && !IconClass.__iconRenderPatched) {
          var originalClassRender = IconClass.render;
          IconClass.render = function() {
            try {
              return originalClassRender.apply(this, arguments);
            } catch (e) {
              return null;
            }
          };
          IconClass.__iconRenderPatched = true;
        }
      } catch (_) {}
    });

    // Also try patching via the createIconSet base class if accessible
    try {
      var createIconSet = require('@expo/vector-icons/build/vendor/react-native-vector-icons/lib/create-icon-set');
      if (createIconSet && createIconSet.default) {
        var BaseIcon = createIconSet.default;
        var baseProto = BaseIcon && BaseIcon.prototype;
        if (baseProto && typeof baseProto.render === 'function' && !baseProto.__iconRenderPatched) {
          var origBaseRender = baseProto.render;
          baseProto.render = function() {
            try { return origBaseRender.apply(this, arguments); } catch (_) { return null; }
          };
          baseProto.__iconRenderPatched = true;
        }
      }
    } catch (_) {}

  } catch (_) {}
})();

// ─── Entry point ──────────────────────────────────────────────────────────────
require('expo-router/entry');
