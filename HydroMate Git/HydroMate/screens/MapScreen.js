import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { refillStations } from '../data/refillStations';
import { Colors } from '../constants/theme';

const darkMapStyle = [
  {
    "elementType": "geometry",
    "stylers": [{ "color": "#0A1628" }]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#8ec3b9" }]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#1a3646" }]
  },
  {
    "featureType": "administrative.country",
    "elementType": "geometry.stroke",
    "stylers": [{ "color": "#4b6878" }]
  },
  {
    "featureType": "administrative.land_parcel",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#64779e" }]
  },
  {
    "featureType": "administrative.province",
    "elementType": "geometry.stroke",
    "stylers": [{ "color": "#4b6878" }]
  },
  {
    "featureType": "landscape.man_made",
    "elementType": "geometry.stroke",
    "stylers": [{ "color": "#334e87" }]
  },
  {
    "featureType": "landscape.natural",
    "elementType": "geometry",
    "stylers": [{ "color": "#023e58" }]
  },
  {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [{ "color": "#283d6a" }]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#6f9ba5" }]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#1d2c4d" }]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry.fill",
    "stylers": [{ "color": "#023e58" }]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#3C7680" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{ "color": "#304a7d" }]
  },
  {
    "featureType": "road",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#98a5be" }]
  },
  {
    "featureType": "road",
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#1d2c4d" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [{ "color": "#2c6675" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry.stroke",
    "stylers": [{ "color": "#255763" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#b0d5ce" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#023e58" }]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{ "color": "#0e1626" }]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#4e6d70" }]
  }
];

export default function MapScreen() {

  const ucsdRegion = {
    latitude: 32.8801,
    longitude: -117.2340,
    latitudeDelta: 0.02, // Adjusts zoom level specifically for campus
    longitudeDelta: 0.02,
  };

  return (
    <View style={styles.container}>
      <MapView 
        style={styles.map} 
        initialRegion={ucsdRegion}
        customMapStyle={darkMapStyle}
        userInterfaceStyle="dark"
      >
        {refillStations.map((station) => (
          <Marker
            key={station.id}
            coordinate={{
              latitude: station.latitude,
              longitude: station.longitude,
            }}
          >
            {/* Custom Marker Icon */}
            <View style={styles.markerContainer}>
              <Text style={styles.markerText}>💧</Text>
            </View>
            
            {/* Custom Callout Card */}
            <Callout>
              <View style={styles.calloutContainer}>
                <Text style={styles.stationLabel}>Water Refill Station</Text>
                <Text style={styles.stationName}>{station.name || "Water Station"}</Text>
                <Text style={styles.stationDetail}>
                  {station.description || "📍 Location not specified"}
                </Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1628',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  calloutContainer: {
    padding: 12,
    minWidth: 180,
    maxWidth: 240,
    borderRadius: 8,
  },
  stationLabel: {
    fontSize: 10,
    color: '#4FC3F7',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  stationName: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#0A1628',
    marginBottom: 6,
  },
  stationDetail: {
    fontSize: 13,
    color: '#546E8A',
    lineHeight: 18,
  },
  markerContainer: {
    backgroundColor: '#4FC3F7',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  markerText: {
    fontSize: 16,
  }
});