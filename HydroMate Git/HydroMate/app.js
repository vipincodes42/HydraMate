import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { registerRootComponent } from 'expo';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { auth } from './firebase';
import FriendsScreen from './screens/FriendsScreen';
import HomeScreen from './screens/HomeScreen';
import LoginScreen from './screens/LoginScreen';
import MapScreen from './screens/MapScreen';

const Tab = createBottomTabNavigator();

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) return null;

  if (!user) return <LoginScreen onLogin={() => {}} />;

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarStyle:             { backgroundColor: '#0A1628', borderTopColor: '#1E3A5F' },
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

registerRootComponent(App);