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

// ─── Phase 4: Walk prototype chain to find & patch the REAL render method ─────
// ROOT CAUSE: `MaterialIcons` INHERITS render from the base `Icon` class —
// it does NOT define its own render. So patching `MaterialIcons.prototype.render`
// patches undefined and the real crash site in the base class is never touched.
// We must walk up Object.getPrototypeOf() until we find the prototype that
// *actually owns* the render method, then wrap it there.
(function patchVectorIconsRender() {
  try {
    var vectorIcons = require('@expo/vector-icons');
    if (!vectorIcons) return;

    var iconSets = ['MaterialIcons', 'MaterialCommunityIcons', 'Ionicons', 'FontAwesome',
      'FontAwesome5', 'AntDesign', 'Entypo', 'EvilIcons', 'Feather', 'Foundation',
      'Octicons', 'SimpleLineIcons', 'Zocial'];

    // Track which prototypes we've already patched (by identity) to avoid double-wrapping
    var patchedProtos = [];

    function alreadyPatched(proto) {
      for (var i = 0; i < patchedProtos.length; i++) {
        if (patchedProtos[i] === proto) return true;
      }
      return false;
    }

    function findOwnerProto(proto) {
      // Walk the prototype chain until we find the prototype that owns 'render'
      var current = proto;
      while (current && current !== Object.prototype) {
        if (Object.prototype.hasOwnProperty.call(current, 'render') &&
            typeof current.render === 'function') {
          return current;
        }
        current = Object.getPrototypeOf(current);
      }
      return null;
    }

    function patchRender(ownerProto) {
      if (!ownerProto || alreadyPatched(ownerProto)) return;
      patchedProtos.push(ownerProto);

      var originalRender = ownerProto.render;
      try {
        ownerProto.render = function safeRender() {
          try {
            return originalRender.apply(this, arguments);
          } catch (e) {
            // isLoadedNative crash — return null to prevent tree crash
            return null;
          }
        };
      } catch (_) {
        // If direct assignment fails, try Object.defineProperty
        try {
          var orig2 = originalRender;
          Object.defineProperty(ownerProto, 'render', {
            value: function safeRender2() {
              try { return orig2.apply(this, arguments); } catch (_) { return null; }
            },
            writable: true, configurable: true, enumerable: false,
          });
        } catch (_) {}
      }
    }

    iconSets.forEach(function(name) {
      try {
        var IconClass = vectorIcons[name];
        if (!IconClass || !IconClass.prototype) return;

        // Find the prototype in the chain that actually owns render
        var ownerProto = findOwnerProto(IconClass.prototype);
        if (ownerProto) {
          patchRender(ownerProto);
        }
      } catch (_) {}
    });

  } catch (_) {}
})();

// ─── Entry point ──────────────────────────────────────────────────────────────
require('expo-router/entry');
