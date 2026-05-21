import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator,
  Alert, Platform, PermissionsAndroid
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BleManager } from 'react-native-ble-plx';
import { subscribeToLive } from '../db';
import { auth } from '../firebase';

const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHAR_UUID    = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

let manager = null;
function getManager() {
  if (!manager) {
    try { manager = new BleManager(); } catch (e) { return null; }
  }
  return manager;
}

async function requestAndroidPermissions() {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version >= 31) {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return Object.values(results).every(r => r === PermissionsAndroid.RESULTS.GRANTED);
  }
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export default function PairCoasterScreen() {
  const [status, setStatus] = useState('idle'); // idle | scanning | connecting | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const scanTimeout = useRef(null);

  // If the coaster is already paired and pushing to Firebase (e.g. paired via nRF Connect),
  // flip to success as soon as live data appears.
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsub = subscribeToLive(uid, (data) => {
      if (data) {
        setStatus((prev) =>
          prev === 'idle' || prev === 'error' ? 'success' : prev
        );
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    return () => {
      manager?.stopDeviceScan();
      if (scanTimeout.current) clearTimeout(scanTimeout.current);
    };
  }, []);

  const pair = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      Alert.alert('Not logged in', 'Please sign in first.');
      return;
    }

    const granted = await requestAndroidPermissions();
    if (!granted) {
      setStatus('error');
      setErrorMsg('Bluetooth permission denied.');
      return;
    }

    setStatus('scanning');
    setErrorMsg('');

    const ble = getManager();
    if (!ble) {
      setStatus('error');
      setErrorMsg('Bluetooth not available in Expo Go — use the dev build.');
      return;
    }

    const bleState = await ble.state();
    if (bleState !== 'PoweredOn') {
      await new Promise((resolve) => {
        const sub = ble.onStateChange((state) => {
          if (state === 'PoweredOn') { sub.remove(); resolve(); }
        }, true);
      });
    }

    scanTimeout.current = setTimeout(() => {
      ble.stopDeviceScan();
      setStatus('error');
      setErrorMsg("Coaster not found. Make sure it's powered on and the LEDs are pulsing purple.");
    }, 15000);

    ble.startDeviceScan(null, null, async (error, device) => {
      if (error) {
        clearTimeout(scanTimeout.current);
        setStatus('error');
        setErrorMsg(error.message);
        return;
      }

      if (device?.name === 'HydraMate') {
        ble.stopDeviceScan();
        clearTimeout(scanTimeout.current);
        setStatus('connecting');

        try {
          const connected = await device.connect();
          await connected.requestMTU(512);
          await connected.discoverAllServicesAndCharacteristics();
          const encoded = btoa(uid);
          await connected.writeCharacteristicWithoutResponseForService(
            SERVICE_UUID, CHAR_UUID, encoded
          );
          setStatus('success');
        } catch (e) {
          if (e.message?.includes('disconnected')) {
            setStatus('success');
          } else {
            setStatus('error');
            setErrorMsg(e.message);
          }
        }
      }
    });
  };

  const isError = status === 'error';
  const isSuccess = status === 'success';

  return (
    <View style={styles.container}>

      {/* Icon circle — changes color/icon based on state */}
      <View style={[
        styles.iconCircle,
        isError && styles.iconCircleError,
        isSuccess && styles.iconCircleSuccess,
      ]}>
        {(status === 'scanning' || status === 'connecting')
          ? <ActivityIndicator size="large" color="#fff" />
          : <Ionicons
              name={isError ? 'wifi-outline' : 'bluetooth'}
              size={48}
              color="#fff"
            />
        }
      </View>

      <Text style={styles.title}>pair your coaster</Text>
      <Text style={styles.subtitle}>
        Power on your HydraMate coaster. The LEDs will pulse purple when ready to pair.
      </Text>

      {/* Scanning label */}
      {(status === 'scanning' || status === 'connecting') && (
        <Text style={styles.scanningText}>
          {status === 'scanning' ? 'Scanning for coaster...' : 'Connecting...'}
        </Text>
      )}

      {/* Error card */}
      {status === 'error' && (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>connection failed</Text>
          <Text style={styles.errorMessage}>{errorMsg}</Text>
        </View>
      )}

      {/* Success calibration steps */}
      {status === 'success' && (
        <View style={styles.stepCard}>
          <View style={styles.step}>
            <View style={[styles.ledDot, { backgroundColor: '#C8A84B' }]} />
            <Text style={styles.stepText}>LEDs are flashing yellow — place your water bottle on the coaster</Text>
          </View>
          <View style={styles.step}>
            <View style={[styles.ledDot, { backgroundColor: '#AAAAAA' }]} />
            <Text style={styles.stepText}>Hold the bottle still for 2 seconds</Text>
          </View>
          <View style={styles.step}>
            <View style={[styles.ledDot, { backgroundColor: '#7BAE7F' }]} />
            <Text style={styles.stepText}>LEDs flash green — calibration complete, you're all set!</Text>
          </View>
        </View>
      )}

      {/* Primary button */}
      {status === 'idle' && (
        <Pressable style={styles.button} onPress={pair}>
          <Text style={styles.buttonText}>Scan for Coaster</Text>
        </Pressable>
      )}
      {status === 'error' && (
        <Pressable style={styles.button} onPress={pair}>
          <Text style={styles.buttonText}>Try Again</Text>
        </Pressable>
      )}
      {status === 'success' && (
        <Pressable style={[styles.button, { marginTop: 8 }]} onPress={() => setStatus('idle')}>
          <Text style={styles.buttonText}>Pair Another Coaster</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0E8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#7BAE7F',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  iconCircleError: {
    backgroundColor: '#C97B7B',
  },
  iconCircleSuccess: {
    backgroundColor: '#7BAE7F',
  },
  title: {
    color: '#2C2C2C',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    color: '#888888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  scanningText: {
    color: '#7BAE7F',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 24,
  },
  errorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  errorTitle: {
    color: '#C97B7B',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#888888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  stepCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    gap: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  ledDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    marginTop: 3,
    flexShrink: 0,
  },
  stepText: {
    color: '#555555',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  button: {
    backgroundColor: '#7BAE7F',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
