/**
 * Expo Config Plugin: Force-remove media/storage/camera permissions from AndroidManifest.
 *
 * Google Play rejects apps that declare READ_MEDIA_IMAGES / READ_MEDIA_VIDEO unless
 * they have a core photo/video use case. Some transitive libraries inject these
 * permissions with `tools:node="replace"` or no merge strategy, overriding the
 * `blockedPermissions` array in app.json.
 *
 * This plugin adds explicit <uses-permission tools:node="remove"> entries AFTER
 * all library manifests are merged, ensuring they are stripped from the final APK.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

const PERMISSIONS_TO_REMOVE = [
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.CAMERA',
  'android.permission.RECORD_AUDIO',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'android.permission.FOREGROUND_SERVICE_CAMERA',
  'android.permission.FOREGROUND_SERVICE_MICROPHONE',
  'android.permission.USE_EXACT_ALARM',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.ACTIVITY_RECOGNITION',
];

const withBlockPermissions = (config) => {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // Ensure tools namespace is declared on the root manifest element
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    // Get existing uses-permission entries
    const existingPerms = manifest['uses-permission'] || [];

    // Build a set of permissions already listed for removal
    const alreadyRemoved = new Set(
      existingPerms
        .filter((p) => p.$['tools:node'] === 'remove')
        .map((p) => p.$['android:name'])
    );

    // Remove any existing grants for these permissions (so we only have the remove entry)
    const filteredPerms = existingPerms.filter((p) => {
      const name = p.$['android:name'];
      return !PERMISSIONS_TO_REMOVE.includes(name) || p.$['tools:node'] === 'remove';
    });

    // Add force-remove entries for each blocked permission
    for (const perm of PERMISSIONS_TO_REMOVE) {
      if (!alreadyRemoved.has(perm)) {
        filteredPerms.push({
          $: {
            'android:name': perm,
            'tools:node': 'remove',
          },
        });
      }
    }

    manifest['uses-permission'] = filteredPerms;

    return cfg;
  });
};

module.exports = withBlockPermissions;
