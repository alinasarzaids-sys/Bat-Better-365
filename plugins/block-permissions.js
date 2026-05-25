/**
 * Expo Config Plugin: Force-remove media/storage/camera permissions from AndroidManifest.
 *
 * Wrapped in try/catch so that if @expo/config-plugins cannot be resolved
 * (e.g. during iOS EAS builds), the plugin exits gracefully and the build continues.
 */

const BILLING_PERMISSIONS = ['com.android.vending.BILLING'];

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

function applyManifestChanges(cfg) {
  try {
    const manifest = cfg.modResults.manifest;

    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    const existingPerms = manifest['uses-permission'] || [];

    const alreadyRemoved = new Set(
      existingPerms
        .filter((p) => p.$['tools:node'] === 'remove')
        .map((p) => p.$['android:name'])
    );

    const filteredPerms = existingPerms.filter((p) => {
      const name = p.$['android:name'];
      return !PERMISSIONS_TO_REMOVE.includes(name) || p.$['tools:node'] === 'remove';
    });

    for (const perm of PERMISSIONS_TO_REMOVE) {
      if (!alreadyRemoved.has(perm)) {
        filteredPerms.push({ $: { 'android:name': perm, 'tools:node': 'remove' } });
      }
    }

    for (const perm of BILLING_PERMISSIONS) {
      const alreadyPresent = filteredPerms.some(
        (p) => p.$['android:name'] === perm && p.$['tools:node'] !== 'remove'
      );
      if (!alreadyPresent) {
        const idx = filteredPerms.findIndex((p) => p.$['android:name'] === perm);
        if (idx !== -1) filteredPerms.splice(idx, 1);
        filteredPerms.push({ $: { 'android:name': perm } });
      }
    }

    manifest['uses-permission'] = filteredPerms;
  } catch (e) {
    console.warn('[block-permissions] Manifest modification failed, skipping:', e.message);
  }
  return cfg;
}

function withBlockPermissions(config) {
  // Try multiple ways to load withAndroidManifest
  let withAndroidManifest;
  const candidates = [
    '@expo/config-plugins',
    'expo/config-plugins',
    '@expo/config-plugins/build/plugins/withAndroidManifest',
  ];
  for (const pkg of candidates) {
    try {
      const mod = require(pkg);
      withAndroidManifest = mod.withAndroidManifest;
      if (typeof withAndroidManifest === 'function') break;
    } catch {}
  }

  if (typeof withAndroidManifest !== 'function') {
    // Cannot load the helper — return config unchanged so iOS builds are not blocked
    console.warn('[block-permissions] Could not load withAndroidManifest; skipping Android permission removal.');
    return config;
  }

  return withAndroidManifest(config, applyManifestChanges);
}

module.exports = withBlockPermissions;
