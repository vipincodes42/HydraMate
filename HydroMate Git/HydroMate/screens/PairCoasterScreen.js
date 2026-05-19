import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator,
  Alert, Platform, PermissionsAndroid
} from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { auth } from '../firebase';

const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHAR_UUID    = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

const manager = new BleManager();

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

  useEffect(() => {
    return () => {
      manager.stopDeviceScan();
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

    // Wait for Bluetooth to be powered on before scanning
    const bleState = await manager.state();
    if (bleState !== 'PoweredOn') {
      await new Promise((resolve) => {
        const sub = manager.onStateChange((state) => {
          if (state === 'PoweredOn') { sub.remove(); resolve(); }
        }, true);
      });
    }

    scanTimeout.current = setTimeout(() => {
      manager.stopDeviceScan();
      setStatus('error');
      setErrorMsg("Coaster not found. Make sure it's powered on and the LEDs are pulsing purple.");
    }, 15000);

    manager.startDeviceScan(null, null, async (error, device) => {
      if (error) {
        clearTimeout(scanTimeout.current);
        setStatus('error');
        setErrorMsg(error.message);
        return;
      }

      if (device?.name === 'HydraMate') {
        manager.stopDeviceScan();
        clearTimeout(scanTimeout.current);
        setStatus('connecting');

        try {
          const connected = await device.connect();
          await connected.requestMTU(512);
          await connected.discoverAllServicesAndCharacteristics();
          const encoded = btoa(uid);
          // Use withoutResponse since ESP32 reboots immediately after receiving UID
          await connected.writeCharacteristicWithoutResponseForService(
            SERVICE_UUID, CHAR_UUID, encoded
          );
          setStatus('success');
        } catch (e) {
          // Disconnect error after write = ESP32 rebooted after saving UID = success
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pair Your Coaster</Text>
      <Text style={styles.subtitle}>
        Power on your HydraMate coaster. The LEDs will pulse purple when ready to pair.
      </Text>

      {status === 'idle' && (
        <Pressable style={styles.button} onPress={pair}>
          <Text style={styles.buttonText}>Scan for Coaster</Text>
        </Pressable>
      )}

      {(status === 'scanning' || status === 'connecting') && (
        <View style={styles.statusBox}>
          <ActivityIndicator size="large" color="#4FC3F7" />
          <Text style={styles.statusText}>
            {status === 'scanning' ? 'Scanning for coaster...' : 'Connecting...'}
          </Text>
          <Text style={styles.subtitle}>Make sure the LEDs are pulsing purple.</Text>
        </View>
      )}

      {status === 'success' && (
        <View style={styles.statusBox}>
          <Text style={styles.successText}>Coaster paired!</Text>
          <Text style={styles.subtitle}>
            Your coaster will now send data to your account.
          </Text>
          <Pressable style={[styles.button, { marginTop: 20 }]} onPress={() => setStatus('idle')}>
            <Text style={styles.buttonText}>Pair Another</Text>
          </Pressable>
        </View>
      )}

      {status === 'error' && (
        <View style={styles.statusBox}>
          <Text style={styles.errorText}>Connection failed</Text>
          <Text style={styles.subtitle}>{errorMsg}</Text>
          <Pressable style={styles.button} onPress={pair}>
            <Text style={styles.buttonText}>Try Again</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1628',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  subtitle: {
    color: '#546E8A',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#4FC3F7',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  buttonText: {
    color: '#0A1628',
    fontWeight: 'bold',
    fontSize: 16,
  },
  statusBox: {
    alignItems: 'center',
    gap: 16,
  },
  statusText: {
    color: '#4FC3F7',
    fontSize: 16,
  },
  successText: {
    color: '#6BAD6A',
    fontSize: 22,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
