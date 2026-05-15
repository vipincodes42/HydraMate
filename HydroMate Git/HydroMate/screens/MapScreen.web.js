import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { refillStations } from '../data/refillStations';

export default function MapScreenWeb() {
  return (
    <View style={styles.container}>
      <View style={styles.mapPreview}>
        <View style={styles.mapHeader}>
          <Text style={styles.mapTitle}>water refill map</Text>
          <View style={styles.badge}>
            <Ionicons name="desktop-outline" size={14} color="#6BAD6A" />
            <Text style={styles.badgeText}>web preview</Text>
          </View>
        </View>

        <View style={styles.markerLayer}>
          {refillStations.slice(0, 7).map((station, index) => (
            <View
              key={station.id}
              style={[
                styles.marker,
                {
                  left: `${18 + (index % 4) * 20}%`,
                  top: `${22 + Math.floor(index / 4) * 28 + (index % 2) * 8}%`,
                },
              ]}
            >
              <Ionicons name="water" size={16} color="#FFFFFF" />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.sheet}>
        <Text style={styles.sectionLabel}>nearby stations</Text>
        <FlatList
          data={refillStations}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable style={styles.stationCard}>
              <View style={styles.stationIcon}>
                <Ionicons name="water-outline" size={18} color="#6BAD6A" />
              </View>
              <View style={styles.stationText}>
                <Text style={styles.stationName}>{item.name || 'Water Station'}</Text>
                <Text style={styles.stationDescription} numberOfLines={2}>
                  {item.description || 'Refill station on campus'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C4C4C4" />
            </Pressable>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0EB',
  },
  mapPreview: {
    height: 290,
    backgroundColor: '#A8D9CA',
    paddingHorizontal: 24,
    paddingTop: 56,
    overflow: 'hidden',
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  mapTitle: {
    color: '#2C2C2C',
    fontSize: 24,
    fontWeight: '800',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: '#6BAD6A',
    fontSize: 12,
    fontWeight: '700',
  },
  markerLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  marker: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#6BAD6A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  sheet: {
    flex: 1,
    marginTop: -24,
    backgroundColor: '#F5F0EB',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  sectionLabel: {
    color: '#2C2C2C',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },
  stationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  stationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBF5E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stationText: {
    flex: 1,
  },
  stationName: {
    color: '#2C2C2C',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  stationDescription: {
    color: '#9E9E9E',
    fontSize: 12,
  },
});
