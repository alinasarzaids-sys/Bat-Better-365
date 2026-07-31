module.exports = function (api) {
  // Cache the Babel config keyed by NODE_ENV (dev vs prod).
  // api.cache(false) was causing Metro to re-process every file from scratch
  // on every production build, triggering OOM / timeout (exit code 1).
  api.cache.using(() => process.env.NODE_ENV);
  return {
    presets: ['babel-preset-expo'],
  };
};
