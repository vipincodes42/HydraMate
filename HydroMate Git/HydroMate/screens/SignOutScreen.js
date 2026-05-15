import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { get, ref } from 'firebase/database';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { auth, db } from '../firebase';

const PLANT_LVL6 = require('../assets/images/plantlvl6.png');

export default function SignOutScreen() {
    const router = useRouter();
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [username, setUsername] = useState('');
    const user = auth.currentUser;
    const profileName = username ? `@${username}` : user?.displayName || user?.email || 'your profile';

    useEffect(() => {
        if (!user?.uid) return;

        let isMounted = true;
        get(ref(db, `users/${user.uid}/profile/username`))
            .then((snap) => {
                if (isMounted && snap.exists()) {
                    setUsername(snap.val());
                }
            })
            .catch((e) => {
                console.warn('Unable to load username for signout screen:', e);
            });

        return () => {
            isMounted = false;
        };
    }, [user?.uid]);

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
        <View style={styles.container}>
            <View style={styles.content}>
                <View style={styles.avatarWrap}>
                    <Image source={PLANT_LVL6} style={styles.plant} resizeMode="contain" />
                </View>

                <Text style={styles.name}>{profileName}</Text>
                <Text style={styles.email}>{user?.email || 'ready for your next hydration check-in'}</Text>

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
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F0EB',
        paddingHorizontal: 28,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
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
        marginBottom: 28,
        textAlign: 'center',
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
