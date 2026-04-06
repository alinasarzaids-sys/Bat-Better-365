import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider, AuthProvider } from '@/template';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';

// Suppress Android-only expo-video SimpleCache conflict that occurs when
// the host container already holds a VideoCache instance for the same folder.
// This is an environment-level native conflict — the app does not use expo-video.
LogBox.ignoreLogs([
  'Another SimpleCache instance',
  'ExpoVideoCache',
  'NativeUnimoduleProxy',
  'Exception in HostObject::get for prop',
]);

export default function RootLayout() {
  return (
    <AlertProvider>
      <AuthProvider>
        <SafeAreaProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false, animation: 'fade' }} />
            <Stack.Screen name="profile-setup" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="profile" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="settings" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="privacy-policy" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="terms" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="faqs" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen 
              name="session-drills" 
              options={{ 
                headerShown: false,
                animation: 'slide_from_bottom',
                presentation: 'modal'
              }} 
            />
            <Stack.Screen 
              name="session-freestyle" 
              options={{ 
                headerShown: false,
                animation: 'slide_from_bottom',
                presentation: 'modal'
              }} 
            />

            <Stack.Screen 
              name="drill-detail" 
              options={{ 
                headerShown: false,
                animation: 'slide_from_bottom',
                presentation: 'modal'
              }} 
            />
            <Stack.Screen 
              name="drill-start" 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right',
                presentation: 'card'
              }} 
            />
            <Stack.Screen 
              name="workout-tracking" 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right',
                presentation: 'card'
              }} 
            />
            <Stack.Screen 
              name="technical-tracking" 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right',
                presentation: 'card'
              }} 
            />
            <Stack.Screen 
              name="workout-complete" 
              options={{ 
                headerShown: false,
                animation: 'fade',
                presentation: 'card'
              }} 
            />
            <Stack.Screen 
              name="session-success" 
              options={{ 
                headerShown: false,
                animation: 'fade',
                presentation: 'card'
              }} 
            />
            <Stack.Screen 
              name="tactical-scenario" 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right',
                presentation: 'card'
              }} 
            />
            <Stack.Screen 
              name="tactical-complete" 
              options={{ 
                headerShown: false,
                animation: 'fade',
                presentation: 'card'
              }} 
            />
            <Stack.Screen 
              name="mental-complete" 
              options={{ 
                headerShown: false,
                animation: 'fade',
                presentation: 'card'
              }} 
            />
            <Stack.Screen 
              name="session-analytics" 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right',
                presentation: 'card'
              }} 
            />
            <Stack.Screen 
              name="technical-complete" 
              options={{ 
                headerShown: false,
                animation: 'fade',
                presentation: 'card'
              }} 
            />
          </Stack>
        </SafeAreaProvider>
      </AuthProvider>
    </AlertProvider>
  );
}
