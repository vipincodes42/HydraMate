import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '../../components/haptic-tab';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle:             { backgroundColor: '#0A1628', borderTopColor: '#1E3A5F' },
        tabBarActiveTintColor:   '#4FC3F7',
        tabBarInactiveTintColor: '#546E8A',
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: '💧 Today',
          // Optionally, disable default icons since the App.js uses emojis in the labels
          tabBarIconStyle: { display: 'none' }, // Hides the placeholder icon area cleanly
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          tabBarLabel: '👥 Friends',
          tabBarIconStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          tabBarLabel: '🗺 Stations',
          tabBarIconStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}
