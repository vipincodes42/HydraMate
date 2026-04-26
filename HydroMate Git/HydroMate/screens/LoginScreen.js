import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { auth } from '../firebase';

export default function LoginScreen({ onLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [isNew, setIsNew]       = useState(false);

  async function handleSubmit() {
    try {
      if (isNew) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onLogin();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>💧 HydroMate</Text>
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