import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, RefreshCw, Users, Settings as SettingsIcon } from 'lucide-react-native';

// Import Screens
import HomeScreen from './src/screens/HomeScreen';
import SwapScreen from './src/screens/SwapScreen';
import NetworkScreen from './src/screens/NetworkScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

// Custom Dark Theme matching our design system
const AppTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#121214',
    card: '#1C1C1E',
    text: '#FFFFFF',
    border: '#2C2C2E',
    notification: '#FF453A',
  },
};

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <NavigationContainer theme={AppTheme}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: '#00D2FF',
            tabBarInactiveTintColor: '#8E8E93',
            tabBarStyle: {
              backgroundColor: '#1C1C1E',
              borderTopColor: '#2C2C2E',
              borderTopWidth: 1,
              height: 60,
              paddingBottom: 8,
              paddingTop: 8,
            },
            tabBarLabelStyle: {
              fontSize: 10,
              fontWeight: '600',
            },
            tabBarIcon: ({ color, size }) => {
              if (route.name === 'Dashboard') {
                return <Home size={size} color={color} />;
              } else if (route.name === 'Swap') {
                return <RefreshCw size={size} color={color} />;
              } else if (route.name === 'Network') {
                return <Users size={size} color={color} />;
              } else if (route.name === 'Settings') {
                return <SettingsIcon size={size} color={color} />;
              }
              return null;
            },
          })}
        >
          <Tab.Screen name="Dashboard" component={HomeScreen} />
          <Tab.Screen name="Swap" component={SwapScreen} />
          <Tab.Screen name="Network" component={NetworkScreen} />
          <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121214',
  },
});
