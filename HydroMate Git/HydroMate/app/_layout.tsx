import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Modal, View, Text, TextInput, Pressable, StyleSheet, Alert, TouchableWithoutFeedback, Keyboard } from 'react-native';
import 'react-native-reanimated';
import { auth, db } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { syncUserProfile, setUsername } from '../db';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Realtime Interception States
  const [needsUsername, setNeedsUsername] = useState(false);
  const [isBrandNew, setIsBrandNew] = useState(false);
  const [draftUsername, setDraftUsername] = useState('');
  const [draftDisplayName, setDraftDisplayName] = useState('');

  const router   = useRouter();
  const segments = useSegments();

  // ── Firebase auth listener (mirrors App.js onAuthStateChanged) ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
          // Prevent race-condition overlay if user just registered (LoginScreen processes their payload)
          setIsBrandNew(Date.now() - new Date(u.metadata.creationTime).getTime() < 10000);
          console.log("Current Logged-in UID:", u.uid);
          await syncUserProfile(u);
      } else {
          setNeedsUsername(false);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Realtime Username Database Index Listener ──
  useEffect(() => {
    if (!user) return;
    const userRef = ref(db, `users/${user.uid}/profile/usernameLower`);
    const unsub = onValue(userRef, (snap) => {
        setNeedsUsername(!snap.exists());
    });
    return () => unsub();
  }, [user]);

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

  const handleClaimUsername = async () => {
      if (!draftUsername.trim()) return;
      if (!draftDisplayName.trim()) {
          Alert.alert("Display Name Required", "Please enter a display name.");
          return;
      }
      try {
          await setUsername(user.uid, draftUsername, draftDisplayName.trim(), user.email);
      } catch(e) {
          Alert.alert("Error", e.message);
      }
  };

  // Show nothing while Firebase resolves auth 
  if (loading) return null;

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle:      { backgroundColor: '#0A1628' },
          headerTintColor:  '#4FC3F7',
          headerShown:      false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login"  options={{ headerShown: false }} />
        <Stack.Screen name="modal"  options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="dark" />

      {/* Legacy User Intercept Modal */}
      <Modal visible={needsUsername && !!user && segments[0] !== 'login' && !isBrandNew} animationType="slide" transparent>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={StyleSheet.absoluteFillObject}>
                  <View style={legacyStyles.overlay}>
                      <View style={legacyStyles.card}>
                          <Text style={legacyStyles.title}>Almost there! 🎉</Text>
                          <Text style={legacyStyles.subtitle}>Pick a display name and unique username to enable the Friends System!</Text>
                          <TextInput
                              style={legacyStyles.input}
                              placeholder="Display Name"
                              placeholderTextColor="#546E8A"
                              value={draftDisplayName}
                              onChangeText={setDraftDisplayName}
                          />
                          <TextInput
                              style={legacyStyles.input}
                              placeholder="Username (no spaces)"
                              placeholderTextColor="#546E8A"
                              value={draftUsername}
                              onChangeText={setDraftUsername}
                              autoCapitalize="none"
                          />
                          <Pressable style={legacyStyles.button} onPress={handleClaimUsername}>
                              <Text style={legacyStyles.buttonText}>Claim Username</Text>
                          </Pressable>
                      </View>
                  </View>
              </View>
          </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const legacyStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(10,22,40,0.95)', justifyContent: 'center', padding: 20 },
    card: { backgroundColor: '#0D2137', padding: 24, borderRadius: 16, borderWidth: 1, borderColor: '#1E3A5F' },
    title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
    subtitle: { color: '#4FC3F7', textAlign: 'center', marginBottom: 20 },
    input: { backgroundColor: '#0A1628', color: '#fff', borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#1E3A5F' },
    button: { backgroundColor: '#4FC3F7', padding: 16, borderRadius: 10, alignItems: 'center' },
    buttonText: { color: '#0A1628', fontWeight: 'bold', fontSize: 16 }
});
