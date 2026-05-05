import { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { getTodayReadings, subscribeToLive } from '../db';
import { auth } from '../firebase';

const DAILY_GOAL_ML = 2000;

const PLANT_IMAGES = [
    require('../assets/images/plantlvl1.png'),
    require('../assets/images/plantlvl2.png'),
    require('../assets/images/plantlvl3.png'),
    require('../assets/images/plantlvl4.png'),
    require('../assets/images/plantlvl5.png'),
    require('../assets/images/plantlvl6.png'),
];

function getPlantImage(pct) {
    if (pct === 0)        return PLANT_IMAGES[0];
    if (pct <= 0.20)      return PLANT_IMAGES[1];
    if (pct <= 0.40)      return PLANT_IMAGES[2];
    if (pct <= 0.60)      return PLANT_IMAGES[3];
    if (pct <= 0.80)      return PLANT_IMAGES[4];
    return PLANT_IMAGES[5];
}

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'good morning';
    if (h < 17) return 'good afternoon';
    return 'good evening';
}

function formatTime(ts) {
    return new Date(ts)
        .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        .toLowerCase();
}

export default function HomeScreen() {
    const [live, setLive] = useState(null);
    const [readings, setReadings] = useState([]);
    const uid = auth.currentUser?.uid;
    const displayName = auth.currentUser?.displayName || 'there';
    const fillAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!uid) return;
        const unsub = subscribeToLive(uid, (data) => {
            setLive(data);
            const pct = Math.min(
                (data?.totalDrankML ?? data?.totalDrunkML ?? 0) / DAILY_GOAL_ML,
                1
            );
            Animated.spring(fillAnim, { toValue: pct, useNativeDriver: false }).start();
        });
        getTodayReadings(uid).then(setReadings);
        return () => unsub();
    }, [uid]);

    const drankMl = live?.totalDrankML ?? live?.totalDrunkML ?? 0;
    const pct = Math.min(drankMl / DAILY_GOAL_ML, 1);
    const weightG = live?.weightG;

    const fillWidth = fillAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <View style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <Text style={styles.greeting}>{getGreeting()}, {displayName}!</Text>
                <Text style={styles.title}>your plant is growing!</Text>

                {/* Main hydration card */}
                <View style={styles.mainCard}>
                    <Image source={getPlantImage(pct)} style={styles.plantImage} resizeMode="contain" />

                    <Text style={styles.hydrationLabel}>today's hydration</Text>
                    <View style={styles.hydrationRow}>
                        <Text style={styles.hydrationAmount}>{drankMl}ml</Text>
                        <Text style={styles.hydrationGoal}> / {DAILY_GOAL_ML}ml</Text>
                    </View>

                    <View style={styles.progressTrack}>
                        <Animated.View style={[styles.progressFill, { width: fillWidth }]} />
                    </View>

                    {/* Bottle level card */}
                    <View style={styles.bottleCard}>
                        <View>
                            <Text style={styles.bottleLabel}>bottle level</Text>
                            <Text style={styles.bottleWeight}>
                                {weightG != null ? `${Math.round(weightG)}g remaining` : '-- g remaining'}
                            </Text>
                        </View>
                        <View style={[
                            styles.bottleDot,
                            { backgroundColor: weightG != null && weightG > 100 ? '#6BAD6A' : '#CCCCCC' }
                        ]} />
                    </View>
                </View>

                {/* Hydration alert */}
                {live?.alertActive && (
                    <View style={styles.alertBanner}>
                        <Text style={styles.alertText}>Time to drink! Your coaster is pulsing.</Text>
                    </View>
                )}

                {/* Today's activity */}
                <Text style={styles.sectionTitle}>today's activity</Text>
                <View style={styles.activityCard}>
                    {readings.length === 0 ? (
                        <Text style={styles.emptyText}>No activity logged yet today.</Text>
                    ) : (
                        readings.map((r, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.activityRow,
                                    i < readings.length - 1 && styles.activityDivider,
                                ]}
                            >
                                <View style={styles.activityIcon}>
                                    <Text style={styles.activityIconText}>💧</Text>
                                </View>
                                <View>
                                    <Text style={styles.activityMain}>{r.ml}ml consumed</Text>
                                    <Text style={styles.activityTime}>{formatTime(r.ts)}</Text>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F0EB' },
    scroll: { padding: 24, paddingTop: 64, paddingBottom: 40 },

    greeting: { color: '#9E9E9E', fontSize: 15, marginBottom: 4 },
    title: { color: '#2C2C2C', fontSize: 26, fontWeight: '800', marginBottom: 24 },

    mainCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
    },
    plantImage: { width: 140, height: 140, marginBottom: 16, marginTop: 4 },

    hydrationLabel: { color: '#9E9E9E', fontSize: 14, marginBottom: 6 },
    hydrationRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 16 },
    hydrationAmount: { color: '#2C2C2C', fontSize: 38, fontWeight: '800' },
    hydrationGoal: { color: '#9E9E9E', fontSize: 20, fontWeight: '400' },

    progressTrack: {
        width: '100%', height: 10, borderRadius: 5,
        backgroundColor: '#E4DDD4', marginBottom: 16, overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: 5, backgroundColor: '#6BAD6A' },

    bottleCard: {
        width: '100%',
        backgroundColor: '#EBF5E6',
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    bottleLabel: { color: '#9E9E9E', fontSize: 12, marginBottom: 4 },
    bottleWeight: { color: '#2C2C2C', fontSize: 17, fontWeight: '700' },
    bottleDot: { width: 44, height: 44, borderRadius: 22 },

    alertBanner: {
        backgroundColor: '#FFF9C4',
        borderRadius: 12,
        padding: 14,
        marginBottom: 20,
    },
    alertText: { color: '#7A6000', textAlign: 'center', fontWeight: '600' },

    sectionTitle: { color: '#2C2C2C', fontSize: 18, fontWeight: '700', marginBottom: 14 },

    activityCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        paddingVertical: 4,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
    },
    activityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 14,
    },
    activityDivider: { borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
    activityIcon: {
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: '#EBF5E6',
        alignItems: 'center', justifyContent: 'center',
    },
    activityIconText: { fontSize: 18 },
    activityMain: { color: '#2C2C2C', fontSize: 15, fontWeight: '600' },
    activityTime: { color: '#9E9E9E', fontSize: 12, marginTop: 2 },
    emptyText: { color: '#9E9E9E', textAlign: 'center', padding: 24, fontStyle: 'italic' },
});
