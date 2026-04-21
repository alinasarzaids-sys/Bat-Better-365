const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const expoVideoStub = path.resolve(__dirname, 'expo-video.js');

// Use resolveRequest to intercept expo-video before Metro loads the real package.
// extraNodeModules does NOT override installed packages — resolveRequest does.
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
