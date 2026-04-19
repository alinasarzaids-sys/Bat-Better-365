const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Redirect expo-video to a no-op stub to prevent Android SimpleCache collision.
// expo-video's native VideoModule auto-registers on startup and conflicts with
// the OnSpace sandbox's existing SimpleCache instance.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'expo-video': path.resolve(__dirname, 'expo-video.js'),
};

module.exports = config;
