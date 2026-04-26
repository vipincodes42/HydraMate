import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { auth } from '../firebase';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const [user, setUser]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router   = useRouter();
  const segments = useSegments();

  // ── Firebase auth listener (mirrors App.js onAuthStateChanged) ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Route guard: redirect to/from login based on auth state ──
  useEffect(() => {
    if (loading) return;
    const inLogin = segments[0] === 'login';
    if (!user && !inLogin) {
      router.replace('/login');
    } else if (user && inLogin) {
      router.replace('/');
    }
  }, [user, loading, segments]);

  // Show nothing while Firebase resolves auth (mirrors `if (loading) return null`)
  if (loading) return null;

  return (
    <>
      <Stack
        screenOptions={{
          // Match App.js tab bar dark theme globally
          headerStyle:      { backgroundColor: '#0A1628' },
          headerTintColor:  '#4FC3F7',
          headerShown:      false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login"  options={{ headerShown: false }} />
        <Stack.Screen name="modal"  options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
