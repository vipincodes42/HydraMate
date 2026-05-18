import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import {
    getHistory,
    getTodayReadings,
    getUserProfile,
    quickAddHydration,
    setHydrationGoal,
    subscribeToLive,
} from '../db';
import { auth } from '../firebase';

const DAILY_GOAL_ML = 2000;
const QUICK_ADD_AMOUNTS = [250, 500, 750];
const GOAL_STEP_ML = 250;

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

function calculateStreakDays(history, goalMl) {
    let streak = 0;
    for (const day of history.slice().reverse()) {
        if ((day.ml ?? 0) < goalMl) break;
        streak += 1;
    }
    return streak;
}

function getActivitySource(reading) {
    return reading?.source === 'coaster' ? 'coaster' : 'manual';
}

export default function HomeScreen() {
    const [live, setLive] = useState(null);
    const [readings, setReadings] = useState([]);
    const [history, setHistory] = useState([]);
    const [dailyGoalMl, setDailyGoalMl] = useState(DAILY_GOAL_ML);
    const [quickAddLoading, setQuickAddLoading] = useState(false);
    const [showAllActivity, setShowAllActivity] = useState(false);
    const [uid, setUid] = useState(auth.currentUser?.uid ?? null);
    const [displayName, setDisplayName] = useState(auth.currentUser?.displayName || 'there');
    const fillAnim = useRef(new Animated.Value(0)).current;

    // Reactively track the signed-in user so the subscription always uses the real UID.
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            const newUid = user?.uid ?? null;
            console.log(`[HOME] Auth state changed — UID: ${newUid}`);
            setUid(newUid);
            setDisplayName(user?.displayName || 'there');
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!uid) return;
        console.log(`[HOME] Setting up live subscription — UID: ${uid} | path: users/${uid}/live`);
        const unsub = subscribeToLive(uid, (data) => {
            console.log(`[HOME] Live update received — UID: ${uid} | data:`, JSON.stringify(data));
            setLive(data);
        });
        getTodayReadings(uid).then(setReadings);
        getHistory(uid, 14).then(setHistory);
        getUserProfile(uid).then((profile) => {
            if (profile?.hydrationGoalMl) setDailyGoalMl(profile.hydrationGoalMl);
        });
        return () => unsub();
    }, [uid]);

    const drankMl = live?.totalDrankML ?? 0;
    const pct = Math.min(drankMl / dailyGoalMl, 1);
    const weightG = live?.weightG;
    const remainingMl = Math.max(dailyGoalMl - drankMl, 0);
    const streakDays = calculateStreakDays(history, dailyGoalMl);
    const ringFillHeight = `${Math.round(pct * 100)}%`;
    const sortedReadings = readings.slice().sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
    const visibleReadings = showAllActivity ? sortedReadings : sortedReadings.slice(0, 3);
    const hasMoreActivity = sortedReadings.length > 3;

    useEffect(() => {
        Animated.timing(fillAnim, {
            toValue: pct,
            duration: 220,
            useNativeDriver: false,
        }).start();
    }, [fillAnim, pct]);

    const fillWidth = fillAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    const refreshDashboard = async () => {
        if (!uid) return;
        const [nextReadings, nextHistory] = await Promise.all([
            getTodayReadings(uid),
            getHistory(uid, 14),
        ]);
        setReadings(nextReadings);
        setHistory(nextHistory);
    };

    const handleQuickAdd = async (amount) => {
        if (!uid || quickAddLoading) return;
        setQuickAddLoading(true);
        try {
            await quickAddHydration(uid, amount);
            await refreshDashboard();
        } catch (e) {
            alert(e.message);
        } finally {
            setQuickAddLoading(false);
        }
    };

    const handleGoalChange = async (delta) => {
        if (!uid) return;
        const nextGoal = Math.max(500, Math.min(6000, dailyGoalMl + delta));
        setDailyGoalMl(nextGoal);
        try {
            await setHydrationGoal(uid, nextGoal);
        } catch (e) {
            alert(e.message);
        }
    };

    return (
        <View style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <Text style={styles.greeting}>{getGreeting()}, {displayName}!</Text>
                <Text style={styles.title}>your plant is growing!</Text>

                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>goal left</Text>
                        <Text style={styles.statValue}>{remainingMl}ml</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>streak</Text>
                        <Text style={styles.statValue}>{streakDays} days</Text>
                    </View>
                </View>

                {/* Main hydration card */}
                <View style={styles.mainCard}>
                    <View style={[styles.progressRing, { borderColor: pct >= 1 ? '#6BAD6A' : '#D9E8D2' }]}>
                        <View style={[styles.progressRingFill, { height: ringFillHeight }]} />
                        <Image source={getPlantImage(pct)} style={styles.plantImage} resizeMode="contain" />
                    </View>

                    <Text style={styles.hydrationLabel}>today's hydration</Text>
                    <View style={styles.hydrationRow}>
                        <Text style={styles.hydrationAmount}>{drankMl}ml</Text>
                        <Text style={styles.hydrationGoal}> / {dailyGoalMl}ml</Text>
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

                    <View style={styles.goalCard}>
                        <View>
                            <Text style={styles.bottleLabel}>hydration goal</Text>
                            <Text style={styles.goalValue}>{dailyGoalMl}ml</Text>
                        </View>
                        <View style={styles.goalControls}>
                            <Pressable style={styles.goalButton} onPress={() => handleGoalChange(-GOAL_STEP_ML)}>
                                <Text style={styles.goalButtonText}>-</Text>
                            </Pressable>
                            <Pressable style={styles.goalButton} onPress={() => handleGoalChange(GOAL_STEP_ML)}>
                                <Text style={styles.goalButtonText}>+</Text>
                            </Pressable>
                        </View>
                    </View>

                    <View style={styles.quickAddRow}>
                        {QUICK_ADD_AMOUNTS.map((amount) => (
                            <Pressable
                                key={amount}
                                style={[styles.quickAddButton, quickAddLoading && styles.quickAddButtonDisabled]}
                                onPress={() => handleQuickAdd(amount)}
                                disabled={quickAddLoading}
                            >
                                <Text style={styles.quickAddText}>+{amount}ml</Text>
                            </Pressable>
                        ))}
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
                        visibleReadings.map((r, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.activityRow,
                                    i < visibleReadings.length - 1 && styles.activityDivider,
                                ]}
                            >
                                <View style={styles.activityIcon}>
                                    <Text style={styles.activityIconText}>💧</Text>
                                </View>
                                <View style={styles.activityInfo}>
                                    <View style={styles.activityTitleRow}>
                                        <Text style={styles.activityMain}>{r.ml}ml consumed</Text>
                                        <View style={[
                                            styles.sourceBadge,
                                            getActivitySource(r) === 'manual' && styles.sourceBadgeManual,
                                        ]}>
                                            <Text style={[
                                                styles.sourceBadgeText,
                                                getActivitySource(r) === 'manual' && styles.sourceBadgeTextManual,
                                            ]}>
                                                {getActivitySource(r)}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={styles.activityTime}>{formatTime(r.ts)}</Text>
                                </View>
                            </View>
                        ))
                    )}

                    {hasMoreActivity && (
                        <Pressable
                            style={styles.showMoreButton}
                            onPress={() => setShowAllActivity((value) => !value)}
                        >
                            <Text style={styles.showMoreText}>
                                {showAllActivity ? 'show less' : `show ${sortedReadings.length - 3} more`}
                            </Text>
                        </Pressable>
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

    statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    statCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    statLabel: { color: '#9E9E9E', fontSize: 12, marginBottom: 5 },
    statValue: { color: '#2C2C2C', fontSize: 21, fontWeight: '800' },

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
    progressRing: {
        width: 162,
        height: 162,
        borderRadius: 81,
        borderWidth: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        overflow: 'hidden',
    },
    progressRingFill: {
        position: 'absolute',
        width: '100%',
        bottom: 0,
        backgroundColor: 'rgba(107,173,106,0.12)',
    },
    plantImage: { width: 128, height: 128, zIndex: 1 },

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
    goalCard: {
        width: '100%',
        backgroundColor: '#F7F4EF',
        borderRadius: 16,
        padding: 16,
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    goalValue: { color: '#2C2C2C', fontSize: 17, fontWeight: '700' },
    goalControls: { flexDirection: 'row', gap: 8 },
    goalButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    goalButtonText: { color: '#6BAD6A', fontSize: 22, fontWeight: '800' },
    quickAddRow: { width: '100%', flexDirection: 'row', gap: 10, marginTop: 14 },
    quickAddButton: {
        flex: 1,
        backgroundColor: '#6BAD6A',
        borderRadius: 14,
        paddingVertical: 12,
        alignItems: 'center',
    },
    quickAddButtonDisabled: { opacity: 0.55 },
    quickAddText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },

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
    activityInfo: { flex: 1 },
    activityTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    activityMain: { color: '#2C2C2C', fontSize: 15, fontWeight: '600' },
    activityTime: { color: '#9E9E9E', fontSize: 12, marginTop: 2 },
    sourceBadge: {
        backgroundColor: '#EBF5E6',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    sourceBadgeManual: { backgroundColor: '#F7F4EF' },
    sourceBadgeText: { color: '#6BAD6A', fontSize: 11, fontWeight: '800' },
    sourceBadgeTextManual: { color: '#8A6F52' },
    emptyText: { color: '#9E9E9E', textAlign: 'center', padding: 24, fontStyle: 'italic' },
    showMoreButton: {
        alignItems: 'center',
        paddingVertical: 14,
        borderTopWidth: 1,
        borderTopColor: '#F5F5F5',
    },
    showMoreText: { color: '#6BAD6A', fontSize: 14, fontWeight: '800' },
});
