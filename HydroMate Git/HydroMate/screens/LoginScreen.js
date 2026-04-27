import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { auth } from '../firebase';
import { checkUsernameExists, setUsername } from '../db';

export default function LoginScreen({ onLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [isNew, setIsNew]       = useState(false);
  
  // New User Registration Fields
  const [username, setSignupUsername] = useState('');
  const [displayName, setDisplayName] = useState('');

  async function handleSubmit() {
    try {
      if (isNew) {
        // Strict Pre-flight Data Validation
        if (!displayName.trim()) throw new Error("Display Name is required.");
        if (!username.trim()) throw new Error("Username is required.");
        
        const unLower = username.toLowerCase().trim();
        const valid = /^[a-zA-Z0-9_]{3,20}$/.test(username);
        if (!valid) throw new Error("Username must be between 3-20 characters without spaces or symbols.");
        
        const exists = await checkUsernameExists(unLower);
        if (exists) throw new Error("That username is already taken!");

        const cred = await createUserWithEmailAndPassword(auth, email, password);
        // Bind payload instantly before route handlers flip UI states
        await setUsername(cred.user.uid, username, displayName, email);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onLogin();
    } catch (e) {
      Alert.alert('Authentication Error', e.message);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>💧 HydroMate</Text>
      
      {isNew && (
          <>
          <TextInput
            style={styles.input}
            placeholder="Display Name"
            placeholderTextColor="#546E8A"
            value={displayName}
            onChangeText={setDisplayName}
          />
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#546E8A"
            value={username}
            onChangeText={setSignupUsername}
            autoCapitalize="none"
          />
          </>
      )}

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#546E8A"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#546E8A"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      
      <Pressable style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>{isNew ? 'Sign Up' : 'Log In'}</Text>
      </Pressable>
      
      <Pressable onPress={() => setIsNew(!isNew)}>
        <Text style={styles.toggle}>
          {isNew ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1628', justifyContent: 'center', padding: 24 },
  title:     { color: '#fff', fontSize: 32, fontWeight: '800', textAlign: 'center', marginBottom: 40 },
  input:     { backgroundColor: '#0D2137', color: '#fff', borderRadius: 10,
               padding: 14, marginBottom: 14, fontSize: 16, borderWidth: 1, borderColor: '#1E3A5F' },
  button:    { backgroundColor: '#4FC3F7', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText:{ color: '#0A1628', fontWeight: '700', fontSize: 16 },
  toggle:    { color: '#546E8A', textAlign: 'center', marginTop: 16 },
});