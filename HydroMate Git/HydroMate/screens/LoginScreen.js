import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { auth } from '../firebase';
import { checkUsernameExists, setUsername } from '../db';

const PLANT_LVL6 = require('../assets/images/plantlvl6.png');

export default function LoginScreen({ onLogin }) {
    const [isNew, setIsNew] = useState(false);

    // Login fields
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Sign-up fields
    const [displayName, setDisplayName] = useState('');
    const [username, setSignupUsername] = useState('');
    const [signupEmail, setSignupEmail] = useState('');
    const [signupPassword, setSignupPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    async function handleLogin() {
        try {
            await signInWithEmailAndPassword(auth, email, password);
            onLogin();
        } catch (e) {
            Alert.alert('Login Failed', e.message);
        }
    }

    async function handleSignUp() {
        try {
            if (!displayName.trim()) throw new Error('Full name is required.');
            if (!username.trim()) throw new Error('Username is required.');

            const unLower = username.toLowerCase().trim();
            const valid = /^[a-zA-Z0-9_]{3,20}$/.test(username);
            if (!valid) throw new Error('Username must be 3-20 characters with no spaces or symbols.');

            if (!signupEmail.trim()) throw new Error('Email is required.');
            if (signupPassword.length < 6) throw new Error('Password must be at least 6 characters.');
            if (signupPassword !== confirmPassword) throw new Error('Passwords do not match.');

            const exists = await checkUsernameExists(unLower);
            if (exists) throw new Error('That username is already taken.');

            const cred = await createUserWithEmailAndPassword(auth, signupEmail, signupPassword);
            await setUsername(cred.user.uid, username, displayName, signupEmail);
            onLogin();
        } catch (e) {
            Alert.alert('Sign Up Failed', e.message);
        }
    }

    if (isNew) {
        return <CreateAccountView
            displayName={displayName}
            setDisplayName={setDisplayName}
            username={username}
            setUsername={setSignupUsername}
            email={signupEmail}
            setEmail={setSignupEmail}
            password={signupPassword}
            setPassword={setSignupPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            onSubmit={handleSignUp}
            onBack={() => setIsNew(false)}
        />;
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                contentContainerStyle={styles.loginScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Branding */}
                <View style={styles.brandingArea}>
                    <Image source={PLANT_LVL6} style={styles.plantHero} resizeMode="contain" />
                    <Text style={styles.appName}>hydramate</Text>
                    <Text style={styles.appSubtitle}>stay hydrated, stay focused</Text>
                </View>

                {/* Smart Coaster feature card */}
                <View style={styles.featureCard}>
                    <View style={styles.featureIcon}>
                        <Ionicons name="add" size={22} color="#FFFFFF" />
                    </View>
                    <View>
                        <Text style={styles.featureTitle}>Smart Coaster</Text>
                        <Text style={styles.featureSubtitle}>Syncs with your Hydration Goals</Text>
                    </View>
                </View>

                {/* Form */}
                <View style={styles.formArea}>
                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor="#BBBBBB"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        autoCorrect={false}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor="#BBBBBB"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />

                    <Pressable style={styles.primaryBtn} onPress={handleLogin}>
                        <Text style={styles.primaryBtnText}>Login</Text>
                    </Pressable>

                    <Pressable onPress={() => setIsNew(true)} style={styles.linkWrap}>
                        <Text style={styles.linkText}>Create an account</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function CreateAccountView({
    displayName, setDisplayName,
    username, setUsername,
    email, setEmail,
    password, setPassword,
    confirmPassword, setConfirmPassword,
    onSubmit, onBack,
}) {
    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                contentContainerStyle={styles.createScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Back link */}
                <Pressable onPress={onBack} style={styles.backLink}>
                    <Ionicons name="arrow-back" size={16} color="#6BAD6A" />
                    <Text style={styles.backLinkText}> Back to login</Text>
                </Pressable>

                {/* Header */}
                <View style={styles.createBranding}>
                    <Image source={PLANT_LVL6} style={styles.createPlant} resizeMode="contain" />
                </View>
                <Text style={styles.createTitle}>create your account</Text>
                <Text style={styles.createSubtitle}>start your hydration journey today</Text>

                {/* Full Name */}
                <Text style={styles.fieldLabel}>Full Name</Text>
                <View style={styles.inputRow}>
                    <Ionicons name="person-outline" size={18} color="#BBBBBB" style={styles.inputIcon} />
                    <TextInput
                        style={styles.inputInner}
                        placeholder="Enter your name"
                        placeholderTextColor="#BBBBBB"
                        value={displayName}
                        onChangeText={setDisplayName}
                    />
                </View>

                {/* Username */}
                <Text style={styles.fieldLabel}>Username</Text>
                <View style={styles.inputRow}>
                    <Ionicons name="at-outline" size={18} color="#BBBBBB" style={styles.inputIcon} />
                    <TextInput
                        style={styles.inputInner}
                        placeholder="Choose a username"
                        placeholderTextColor="#BBBBBB"
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                </View>

                {/* Email */}
                <Text style={styles.fieldLabel}>Email Address</Text>
                <View style={styles.inputRow}>
                    <Ionicons name="mail-outline" size={18} color="#BBBBBB" style={styles.inputIcon} />
                    <TextInput
                        style={styles.inputInner}
                        placeholder="Enter your email"
                        placeholderTextColor="#BBBBBB"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        autoCorrect={false}
                    />
                </View>

                {/* Password */}
                <Text style={styles.fieldLabel}>Password</Text>
                <View style={styles.inputRow}>
                    <Ionicons name="lock-closed-outline" size={18} color="#BBBBBB" style={styles.inputIcon} />
                    <TextInput
                        style={styles.inputInner}
                        placeholder="Create a password"
                        placeholderTextColor="#BBBBBB"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                </View>

                {/* Confirm Password */}
                <Text style={styles.fieldLabel}>Confirm Password</Text>
                <View style={styles.inputRow}>
                    <Ionicons name="lock-closed-outline" size={18} color="#BBBBBB" style={styles.inputIcon} />
                    <TextInput
                        style={styles.inputInner}
                        placeholder="Confirm your password"
                        placeholderTextColor="#BBBBBB"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                    />
                </View>

                <Pressable style={[styles.primaryBtn, styles.createBtn]} onPress={onSubmit}>
                    <Text style={styles.primaryBtnText}>Create Account</Text>
                </Pressable>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F0EB' },

    // ── Login ──
    loginScroll: { flexGrow: 1, padding: 28, paddingTop: 60 },

    brandingArea: { alignItems: 'center', marginBottom: 32 },
    plantHero: { width: 140, height: 140, marginBottom: 16 },
    appName: { fontSize: 34, fontWeight: '800', color: '#2C2C2C', letterSpacing: -0.5, marginBottom: 6 },
    appSubtitle: { fontSize: 15, color: '#9E9E9E' },

    featureCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 32,
        gap: 14,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    featureIcon: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: '#6BAD6A',
        alignItems: 'center', justifyContent: 'center',
    },
    featureTitle: { color: '#2C2C2C', fontWeight: '700', fontSize: 15 },
    featureSubtitle: { color: '#9E9E9E', fontSize: 13, marginTop: 2 },

    formArea: { gap: 0 },
    input: {
        backgroundColor: '#FFFFFF',
        color: '#2C2C2C',
        borderRadius: 14,
        paddingHorizontal: 18,
        paddingVertical: 16,
        fontSize: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
    },

    primaryBtn: {
        backgroundColor: '#6BAD6A',
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: 'center',
        marginTop: 8,
        shadowColor: '#6BAD6A',
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 3,
    },
    primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 17 },

    linkWrap: { alignItems: 'center', marginTop: 20 },
    linkText: { color: '#6BAD6A', fontSize: 15, textDecorationLine: 'underline' },

    // ── Create Account ──
    createScroll: { flexGrow: 1, padding: 28, paddingTop: 56 },

    backLink: { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
    backLinkText: { color: '#6BAD6A', fontSize: 15 },

    createTitle: { color: '#2C2C2C', fontSize: 28, fontWeight: '800', marginBottom: 6 },
    createSubtitle: { color: '#9E9E9E', fontSize: 15, marginBottom: 28 },

    fieldLabel: { color: '#7A7A7A', fontSize: 13, fontWeight: '600', marginBottom: 6 },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
    },
    inputIcon: { marginRight: 10 },
    inputInner: { flex: 1, color: '#2C2C2C', fontSize: 16 },

    createBtn: { marginTop: 8, marginBottom: 24 },

    createBranding: { alignItems: 'center', marginBottom: 8 },
    createPlant: { width: 80, height: 80 },
});
