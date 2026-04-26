
// ═══════════════════════════════════════════════════════════════
//  screens/FriendsScreen.js — friend Hydrotion leaderboard
// ═══════════════════════════════════════════════════════════════
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { getFriendsData } from '../db';
import { auth } from '../firebase';

export default function FriendsScreen() {
    const [friends, setFriends] = useState([]);
    const uid = auth.currentUser?.uid;

    useEffect(() => {
        if (!uid) return;
        getFriendsData(uid).then((data) => {
            setFriends(data.sort((a, b) => (b.live?.totalDrunkMl ?? 0) - (a.live?.totalDrunkMl ?? 0)));
        });
    }, [uid]);

    return (
        <LinearGradient colors={['#0A1628', '#0D2137', '#0A1628']} style={{ flex: 1, padding: 20 }}>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 60, marginBottom: 16 }}>
                Friends 💧
            </Text>
            <FlatList
                data={friends}
                keyExtractor={(item) => item.uid}
                renderItem={({ item, index }) => {
                    const ml = item.live?.totalDrunkMl ?? 0;
                    const pct = Math.min(ml / 2000, 1);
                    return (
                        <View style={{
                            flexDirection: 'row', alignItems: 'center', marginBottom: 16,
                            backgroundColor: '#0D2137', borderRadius: 12, padding: 14
                        }}>
                            <Text style={{ fontSize: 22, marginRight: 10 }}>
                                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '💧'}
                            </Text>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: '#fff', fontWeight: '600' }}>{item.displayName ?? 'Friend'}</Text>
                                <View style={{ height: 6, backgroundColor: '#1E3A5F', borderRadius: 3, marginTop: 6 }}>
                                    <View style={{ height: 6, width: `${pct * 100}%`, backgroundColor: '#4FC3F7', borderRadius: 3 }} />
                                </View>
                            </View>
                            <Text style={{ color: '#4FC3F7', marginLeft: 10, fontWeight: '700' }}>{ml} mL</Text>
                        </View>
                    );
                }}
            />
        </LinearGradient>
    );
}
