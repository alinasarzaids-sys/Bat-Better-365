// Stub to prevent expo-video's SimpleCache from conflicting on Android.
// expo-video is intentionally excluded — use react-native-webview / WebView for video playback.
// This file is resolved by metro.config.js for BOTH dev and production APK builds.

const React = require('react');
const { View } = require('react-native');

// Stub VideoView component — renders nothing
const VideoView = React.forwardRef(function VideoView(_props, _ref) {
  return React.createElement(View, null);
});

// Stub hook — returns a no-op player object
function useVideoPlayer(_source, _setup) {
  return {
    play: function () {},
    pause: function () {},
    replace: function () {},
    seekBy: function () {},
    generateThumbnailsAsync: async function () { return []; },
    currentTime: 0,
    duration: 0,
    playing: false,
    muted: false,
    volume: 1,
    loop: false,
    status: 'idle',
    error: null,
    addListener: function () { return { remove: function () {} }; },
    removeAllListeners: function () {},
  };
}

var _exports = {
  VideoView: VideoView,
  useVideoPlayer: useVideoPlayer,
};

// Support ES module default import without circular reference
_exports.default = {
  VideoView: VideoView,
  useVideoPlayer: useVideoPlayer,
};

module.exports = _exports;
