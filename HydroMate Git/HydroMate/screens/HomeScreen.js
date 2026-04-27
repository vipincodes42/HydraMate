import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions, ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { getHistory, subscribeToLive } from '../db';
import { auth } from '../firebase';

const { width } = Dimensions.get('window');
const DAILY_GOAL_ML = 2000;

function getPlantStage(pct) {
  if (pct < 0.15) return { emoji: '🌱', label: 'Seedling',   color: '#8BC34A' };
  if (pct < 0.35) return { emoji: '🌿', label: 'Sprouting',  color: '#66BB6A' };
  if (pct < 0.60) return { emoji: '🪴', label: 'Growing',    color: '#43A047' };
  if (pct < 0.85) return { emoji: '🌳', label: 'Flourishing',color: '#2E7D32' };
  return               { emoji: '🌻', label: 'Thriving!',    color: '#F9A825' };
}

export default function HomeScreen() {
  const [live, setLive]       = useState(null);
  const [history, setHistory] = useState([]);
  const uid = auth.currentUser?.uid;
  const fillAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToLive(uid, (data) => {
      setLive(data);
      const pct = Math.min((data?.totalDrunkMl ?? 0) / DAILY_GOAL_ML, 1);
      Animated.spring(fillAnim, { toValue: pct, useNativeDriver: false }).start();
    });
    getHistory(uid, 7).then(setHistory);
    return () => unsub();
  }, [uid]);

  const drunkMl   = live?.totalDrunkMl ?? 0;
  const pct       = Math.min(drunkMl / DAILY_GOAL_ML, 1);
  const plant     = getPlantStage(pct);
  const remaining = Math.max(0, DAILY_GOAL_ML - drunkMl);

  const fillHeight = fillAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <LinearGradient colors={['#0A1628', '#0D2137', '#0A1628']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        <Text style={styles.greeting}>HydroMate 💧</Text>
        <Text style={styles.date}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </Text>

        {/* Plant avatar */}
        <View style={styles.plantContainer}>
          <Text style={styles.plantEmoji}>{plant.emoji}</Text>
          <Text style={[styles.plantLabel, { color: plant.color }]}>{plant.label}</Text>
        </View>

        {/* Water bottle progress */}
        <View style={styles.bottleWrap}>
          <View style={styles.bottleShell}>
            <Animated.View style={[styles.bottleFill, { height: fillHeight }]}/>
          </View>
          <Text style={styles.bottleLabel}>{Math.round(pct * 100)}%</Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard label="Consumed"  value={`${drunkMl} mL`}      color="#4FC3F7"/>
          <StatCard label="Goal"      value={`${DAILY_GOAL_ML} mL`} color="#546E8A"/>
          <StatCard label="Remaining" value={`${remaining} mL`}    color="#F06292"/>
        </View>

        {/* Alert banner */}
        {live?.alertActive && (
          <View style={styles.alertBanner}>
            <Text style={styles.alertText}>💧 Time to drink! Your coaster is pulsing blue.</Text>
          </View>
        )}

        {/* Live coaster data */}
        <View style={styles.coasterCard}>
          <Text style={styles.cardTitle}>Coaster Live</Text>
          <Text style={styles.cardSub}>
            Bottle weight: {live?.weightG?.toFixed(0) ?? '--'} g
          </Text>
          <View style={[styles.dot, { backgroundColor: live ? '#4FC3F7' : '#546E8A' }]}/>
        </View>

        {/* 7-day history */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last 7 Days</Text>
          <View style={styles.chartRow}>
            {history.map((day, i) => {
              const h     = Math.max(4, (day.ml / DAILY_GOAL_ML) * 80);
              const label = day.date.slice(6);
              return (
                <View key={i} style={styles.barWrap}>
                  <Text style={styles.barLabel}>{day.ml > 0 ? `${day.ml}` : ''}</Text>
                  <View style={[styles.bar, {
                    height: h,
                    backgroundColor: day.ml >= DAILY_GOAL_ML ? '#4FC3F7' : '#1E3A5F'
                  }]}/>
                  <Text style={styles.barDate}>{label}</Text>
                </View>
              );
            })}
          </View>
        </View>

      </ScrollView>
    </LinearGradient>
  );
}

function StatCard({ label, value, color }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  scroll:         { padding: 20, paddingTop: 60, paddingBottom: 40 },
  greeting:       { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: 1 },
  date:           { color: '#546E8A', fontSize: 14, marginBottom: 24 },

  plantContainer: { alignItems: 'center', marginBottom: 20 },
  plantEmoji:     { fontSize: 80 },
  plantLabel:     { fontSize: 18, fontWeight: '700', marginTop: 8 },

  bottleWrap:     { alignItems: 'center', marginBottom: 24 },
  bottleShell:    { width: 60, height: 140, borderRadius: 8, borderWidth: 2,
                    borderColor: '#4FC3F7', overflow: 'hidden', justifyContent: 'flex-end' },
  bottleFill:     { width: '100%', borderRadius: 6, backgroundColor: '#4FC3F7' },
  bottleLabel:    { color: '#fff', marginTop: 8, fontSize: 18, fontWeight: '700' },

  statsRow:       { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard:       { flex: 1, backgroundColor: '#0D2137', borderRadius: 12,
                    padding: 14, alignItems: 'center' },
  statValue:      { fontSize: 16, fontWeight: '700' },
  statLabel:      { color: '#546E8A', fontSize: 11, marginTop: 4 },

  alertBanner:    { backgroundColor: '#1565C0', borderRadius: 10, padding: 14, marginBottom: 16 },
  alertText:      { color: '#fff', textAlign: 'center', fontWeight: '600' },

  coasterCard:    { backgroundColor: '#0D2137', borderRadius: 12, padding: 16,
                    marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle:      { color: '#fff', fontWeight: '700', flex: 1 },
  cardSub:        { color: '#546E8A', fontSize: 13 },
  dot:            { width: 10, height: 10, borderRadius: 5 },

  section:        { marginBottom: 20 },
  sectionTitle:   { color: '#fff', fontWeight: '700', marginBottom: 12 },
  chartRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 100 },
  barWrap:        { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar:            { width: '100%', borderRadius: 4 },
  barLabel:       { color: '#4FC3F7', fontSize: 9, marginBottom: 2 },
  barDate:        { color: '#546E8A', fontSize: 10, marginTop: 4 },
});