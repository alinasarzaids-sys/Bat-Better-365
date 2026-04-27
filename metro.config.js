const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const expoVideoStub = path.resolve(__dirname, 'expo-video.js');

// Intercept expo-video at Metro resolve time (dev + prod JS bundle).
// This prevents the real expo-video JS from loading and triggering VideoCache init.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'expo-video' || moduleName.startsWith('expo-video/')) {
    return { filePath: expoVideoStub, type: 'sourceFile' };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
