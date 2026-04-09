import { LogBox } from 'react-native';

// Suppress any residual environment-level native module warnings
// that may appear when running inside the OnSpace app container.
LogBox.ignoreLogs([
  'Another SimpleCache instance',
  'ExpoVideoCache',
  'NativeUnimoduleProxy',
  'Exception in HostObject::get for prop',
]);

import 'expo-router/entry';
