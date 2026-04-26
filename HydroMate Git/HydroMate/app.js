 /**
 * HydroMate — React Native App
 * 
 * Setup:
 *   npx create-expo-app HydroMate --template blank
 *   cd HydroMate
 *   npx expo install firebase expo-linear-gradient react-native-maps
 *   npm install @react-navigation/native @react-navigation/bottom-tabs
 *   npx expo install react-native-safe-area-context react-native-screens
 */

// ═══════════════════════════════════════════════════════════════
//  App.js — Root navigator
// ═══════════════════════════════════════════════════════════════
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text } from 'react-native';
import HomeScreen    from './screens/HomeScreen';
import FriendsScreen from './screens/FriendsScreen';
import MapScreen     from './screens/MapScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarStyle:       { backgroundColor: '#0A1628', borderTopColor: '#1E3A5F' },
          tabBarActiveTintColor:   '#4FC3F7',
          tabBarInactiveTintColor: '#546E8A',
          headerShown: false,
        }}
      >
        <Tab.Screen name="Home"    component={HomeScreen}    options={{ tabBarLabel: '💧 Today' }}/>
        <Tab.Screen name="Friends" component={FriendsScreen} options={{ tabBarLabel: '👥 Friends' }}/>
        <Tab.Screen name="Map"     component={MapScreen}     options={{ tabBarLabel: '🗺 Stations' }}/>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

// ═══════════════════════════════════════════════════════════════
//  screens/HomeScreen.js — Gamified plant Hydrotion UI
// ═══════════════════════════════════════════════════════════════
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, Pressable,
  Dimensions, ScrollView, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { auth } from '../firebase';
import { subscribeToLive, getHistory } from '../db';

const { width } = Dimensions.get('window');
const DAILY_GOAL_ML = 2000;

// Plant growth stage based on % of goal
function getPlantStage(pct) {
  if (pct < 0.15) return { emoji: '🌱', label: 'Seedling',  color: '#8BC34A' };
  if (pct < 0.35) return { emoji: '🌿', label: 'Sprouting', color: '#66BB6A' };
  if (pct < 0.60) return { emoji: '🪴', label: 'Growing',   color: '#43A047' };
  if (pct < 0.85) return { emoji: '🌳', label: 'Flourishing',color: '#2E7D32' };
  return               { emoji: '🌻', label: 'Thriving!',   color: '#F9A825' };
}

export default function HomeScreen() {
  const [live, setLive]       = useState(null);
  const [history, setHistory] = useState([]);
  const uid = auth.currentUser?.uid;

  // Animated fill bar
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

  const drunkMl = live?.totalDrunkMl ?? 0;
  const pct     = Math.min(drunkMl / DAILY_GOAL_ML, 1);
  const plant   = getPlantStage(pct);
  const remaining = Math.max(0, DAILY_GOAL_ML - drunkMl);

  const fillHeight = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <LinearGradient colors={['#0A1628', '#0D2137', '#0A1628']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Header */}
        <Text style={styles.greeting}>HydroMate</Text>
        <Text style={styles.date}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</Text>

        {/* Plant avatar */}
        <View style={styles.plantContainer}>
          <Text style={styles.plantEmoji}>{plant.emoji}</Text>
          <Text style={[styles.plantLabel, { color: plant.color }]}>{plant.label}</Text>
        </View>

        {/* Water bottle progress visual */}
        <View style={styles.bottleWrap}>
          <View style={styles.bottleShell}>
            <Animated.View style={[styles.bottleFill, { height: fillHeight, backgroundColor: '#4FC3F7' }]}/>
          </View>
          <Text style={styles.bottleLabel}>{Math.round(pct * 100)}%</Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard label="Consumed"  value={`${drunkMl} mL`}     color="#4FC3F7"/>
          <StatCard label="Goal"      value={`${DAILY_GOAL_ML} mL`} color="#546E8A"/>
          <StatCard label="Remaining" value={`${remaining} mL`}   color="#F06292"/>
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
          <Text style={styles.cardSub}>Bottle weight: {live?.weightG?.toFixed(0) ?? '--'} g</Text>
          <View style={[styles.dot, { backgroundColor: live ? '#4FC3F7' : '#546E8A' }]}/>
        </View>

        {/* 7-day history bar chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last 7 Days</Text>
          <View style={styles.chartRow}>
            {history.map((day, i) => {
              const h = Math.max(4, (day.ml / DAILY_GOAL_ML) * 80);
              const label = day.date.slice(6); // DD
              return (
                <View key={i} style={styles.barWrap}>
                  <Text style={styles.barLabel}>{day.ml > 0 ? `${day.ml}` : ''}</Text>
                  <View style={[styles.bar, { height: h, backgroundColor: day.ml >= DAILY_GOAL_ML ? '#4FC3F7' : '#1E3A5F' }]}/>
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

// ═══════════════════════════════════════════════════════════════
//  screens/FriendsScreen.js — friend Hydrotion leaderboard
// ═══════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { auth } from '../firebase';
import { getFriendsData } from '../db';

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
          const ml  = item.live?.totalDrunkMl ?? 0;
          const pct = Math.min(ml / 2000, 1);
          return (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16,
              backgroundColor: '#0D2137', borderRadius: 12, padding: 14 }}>
              <Text style={{ fontSize: 22, marginRight: 10 }}>
                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '💧'}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>{item.displayName ?? 'Friend'}</Text>
                <View style={{ height: 6, backgroundColor: '#1E3A5F', borderRadius: 3, marginTop: 6 }}>
                  <View style={{ height: 6, width: `${pct * 100}%`, backgroundColor: '#4FC3F7', borderRadius: 3 }}/>
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

// ═══════════════════════════════════════════════════════════════
//  screens/MapScreen.js — campus water station map
// ═══════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { getWaterStations, rateStation } from '../db';

export default function MapScreen() {
  const [stations, setStations] = useState([]);

  useEffect(() => {
    getWaterStations().then(setStations);
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={{ flex: 1 }}
        initialRegion={{
          latitude:      32.7760,
          longitude:    -117.0710,
          latitudeDelta:  0.01,
          longitudeDelta: 0.01,
        }}
        userInterfaceStyle="dark"
      >
        {stations.map((s) => (
          <Marker key={s.id} coordinate={{ latitude: s.lat, longitude: s.lng }} pinColor="#4FC3F7">
            <Callout tooltip>
              <View style={{ backgroundColor: '#0D2137', borderRadius: 10, padding: 12, minWidth: 160 }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{s.name}</Text>
                <Text style={{ color: '#4FC3F7' }}>⭐ {s.rating?.toFixed(1)} ({s.votes} votes)</Text>
                <Text style={{ color: '#8BC34A' }}>{s.filtered ? '✅ Filtered' : '💧 Standard'}</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                  {[1,2,3,4,5].map((r) => (
                    <Pressable key={r} onPress={() => rateStation(s.id, r)}>
                      <Text style={{ fontSize: 18 }}>{'⭐'.repeat(r === 1 ? 1 : 0)}{r}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  styles (shared)
// ═══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container:    { flex: 1 },
  scroll:       { padding: 20, paddingTop: 60, paddingBottom: 40 },
  greeting:     { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: 1 },
  date:         { color: '#546E8A', fontSize: 14, marginBottom: 24 },

  plantContainer: { alignItems: 'center', marginBottom: 20 },
  plantEmoji:   { fontSize: 80 },
  plantLabel:   { fontSize: 18, fontWeight: '700', marginTop: 8 },

  bottleWrap:   { alignItems: 'center', marginBottom: 24 },
  bottleShell:  { width: 60, height: 140, borderRadius: 8, borderWidth: 2,
                  borderColor: '#4FC3F7', overflow: 'hidden', justifyContent: 'flex-end' },
  bottleFill:   { width: '100%', borderRadius: 6 },
  bottleLabel:  { color: '#fff', marginTop: 8, fontSize: 18, fontWeight: '700' },

  statsRow:     { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard:     { flex: 1, backgroundColor: '#0D2137', borderRadius: 12,
                  padding: 14, alignItems: 'center' },
  statValue:    { fontSize: 16, fontWeight: '700' },
  statLabel:    { color: '#546E8A', fontSize: 11, marginTop: 4 },

  alertBanner:  { backgroundColor: '#1565C0', borderRadius: 10, padding: 14, marginBottom: 16 },
  alertText:    { color: '#fff', textAlign: 'center', fontWeight: '600' },

  coasterCard:  { backgroundColor: '#0D2137', borderRadius: 12, padding: 16,
                  marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle:    { color: '#fff', fontWeight: '700', flex: 1 },
  cardSub:      { color: '#546E8A', fontSize: 13 },
  dot:          { width: 10, height: 10, borderRadius: 5 },

  section:      { marginBottom: 20 },
  sectionTitle: { color: '#fff', fontWeight: '700', marginBottom: 12 },
  chartRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 100 },
  barWrap:      { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar:          { width: '100%', borderRadius: 4 },
  barLabel:     { color: '#4FC3F7', fontSize: 9, marginBottom: 2 },
  barDate:      { color: '#546E8A', fontSize: 10, marginTop: 4 },
});