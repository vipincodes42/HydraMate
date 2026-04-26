import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { getWaterStations } from '../db';
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
  const [stations, setStations] = useState([]);

  useEffect(() => {
    // Fetch water stations when component mounts
    async function loadStations() {
      try {
        const data = await getWaterStations();
        setStations(data);
      } catch (error) {
        console.error("Failed to fetch stations:", error);
      }
    }
    loadStations();
  }, []);

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
        {stations.map((station) => (
          <Marker
            key={station.id}
            coordinate={{
              latitude: station.latitude,
              longitude: station.longitude,
            }}
            pinColor={'#4FC3F7'} // Match the Hydramate brand color
          >
            <Callout>
              <View style={styles.calloutContainer}>
                <Text style={styles.stationName}>{station.name || "Water Station"}</Text>
                <Text style={styles.stationDetail}>Rating: {station.rating ? station.rating.toFixed(1) : 'N/A'} ⭐</Text>
                <Text style={styles.stationDetail}>Votes: {station.votes || 0}</Text>
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
    padding: 5,
    minWidth: 120,
  },
  stationName: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  stationDetail: {
    fontSize: 14,
    color: '#555',
  }
});