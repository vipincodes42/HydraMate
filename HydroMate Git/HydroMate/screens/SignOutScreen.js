import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { get, ref } from 'firebase/database';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
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
import { changeUsername } from '../db';
import { auth, db } from '../firebase';

const PLANT_LVL6 = require('../assets/images/plantlvl6.png');

export default function SignOutScreen() {
    const router = useRouter();
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [isSavingUsername, setIsSavingUsername] = useState(false);
    const [username, setUsername] = useState('');
    const [draftUsername, setDraftUsername] = useState('');
    const user = auth.currentUser;
    const profileName = username ? `@${username}` : user?.displayName || user?.email || 'your profile';

    useEffect(() => {
        if (!user?.uid) return;

        let isMounted = true;
        get(ref(db, `users/${user.uid}/profile/username`))
            .then((snap) => {
                if (isMounted && snap.exists()) {
                    const savedUsername = snap.val();
                    setUsername(savedUsername);
                    setDraftUsername(savedUsername);
                }
            })
            .catch((e) => {
                console.warn('Unable to load username for signout screen:', e);
            });

        return () => {
            isMounted = false;
        };
    }, [user?.uid]);

    const handleChangeUsername = async () => {
        if (!user?.uid) return;

        setIsSavingUsername(true);
        try {
            await changeUsername(user.uid, username, draftUsername);
            setUsername(draftUsername.trim());
            Alert.alert('Username Updated', 'Your new username is ready to go.');
        } catch (e) {
            Alert.alert('Username Update Failed', e.message);
        } finally {
            setIsSavingUsername(false);
        }
    };

    const handleStayLoggedIn = () => {
        router.replace('/');
    };

    const handleSignOut = async () => {
        setIsSigningOut(true);
        try {
            await signOut(auth);
            router.replace('/login');
        } catch (e) {
            Alert.alert('Sign Out Failed', e.message);
            setIsSigningOut(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.avatarWrap}>
                    <Image source={PLANT_LVL6} style={styles.plant} resizeMode="contain" />
                </View>

                <Text style={styles.name}>{profileName}</Text>
                <Text style={styles.email}>{user?.email || 'ready for your next hydration check-in'}</Text>

                <View style={styles.usernameCard}>
                    <View style={styles.cardHeader}>
                        <View style={styles.smallIconBadge}>
                            <Ionicons name="at-outline" size={18} color="#6BAD6A" />
                        </View>
                        <View>
                            <Text style={styles.cardTitle}>username</Text>
                            <Text style={styles.cardSubtitle}>choose how friends find you</Text>
                        </View>
                    </View>

                    <TextInput
                        style={styles.usernameInput}
                        placeholder="new_username"
                        placeholderTextColor="#BBBBBB"
                        value={draftUsername}
                        onChangeText={setDraftUsername}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!isSavingUsername && !isSigningOut}
                    />

                    <Pressable
                        style={[
                            styles.saveButton,
                            (isSavingUsername || isSigningOut) && styles.disabledButton,
                        ]}
                        onPress={handleChangeUsername}
                        disabled={isSavingUsername || isSigningOut}
                    >
                        {isSavingUsername ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.saveButtonText}>Update Username</Text>
                        )}
                    </Pressable>
                </View>

                <View style={styles.confirmCard}>
                    <View style={styles.iconBadge}>
                        <Ionicons name="log-out-outline" size={24} color="#6BAD6A" />
                    </View>
                    <Text style={styles.title}>are you sure you want to log out?</Text>

                    <Pressable
                        style={[styles.primaryButton, isSigningOut && styles.disabledButton]}
                        onPress={handleStayLoggedIn}
                        disabled={isSigningOut}
                    >
                        <Text style={styles.primaryButtonText}>Stay Logged In</Text>
                    </Pressable>

                    <Pressable
                        style={[styles.secondaryButton, isSigningOut && styles.disabledButton]}
                        onPress={handleSignOut}
                        disabled={isSigningOut}
                    >
                        {isSigningOut ? (
                            <ActivityIndicator color="#6BAD6A" />
                        ) : (
                            <Text style={styles.secondaryButtonText}>Sign Out</Text>
                        )}
                    </Pressable>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F0EB',
        paddingHorizontal: 28,
    },
    content: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 56,
        paddingBottom: 60,
    },
    avatarWrap: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 18,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    plant: {
        width: 72,
        height: 72,
    },
    name: {
        color: '#2C2C2C',
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 4,
        textAlign: 'center',
    },
    email: {
        color: '#9E9E9E',
        fontSize: 14,
        marginBottom: 20,
        textAlign: 'center',
    },
    usernameCard: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 18,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    smallIconBadge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#EBF5E6',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    cardTitle: {
        color: '#2C2C2C',
        fontSize: 16,
        fontWeight: '800',
        marginBottom: 2,
    },
    cardSubtitle: {
        color: '#9E9E9E',
        fontSize: 12,
    },
    usernameInput: {
        backgroundColor: '#F8F6F3',
        color: '#2C2C2C',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        marginBottom: 12,
    },
    saveButton: {
        backgroundColor: '#6BAD6A',
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
    confirmCard: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 22,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
    },
    iconBadge: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#EBF5E6',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    title: {
        color: '#2C2C2C',
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 20,
    },
    primaryButton: {
        width: '100%',
        backgroundColor: '#6BAD6A',
        borderRadius: 14,
        paddingVertical: 15,
        alignItems: 'center',
        marginBottom: 12,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
    secondaryButton: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderColor: '#6BAD6A',
        borderWidth: 1,
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: '#6BAD6A',
        fontSize: 15,
        fontWeight: '700',
    },
    disabledButton: {
        opacity: 0.65,
    },
});
