const path = require('path');

module.exports = function (api) {
  api.cache(false);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Redirect expo-video to a stub to prevent Android SimpleCache collision
      [
        'module-resolver',
        {
          alias: {
            'expo-video': path.resolve(__dirname, './expo-video.js'),
          },
        },
      ],
    ],
  };
};
