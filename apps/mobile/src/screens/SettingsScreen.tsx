import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Switch, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { Shield, Fingerprint, Lock, Eye, LogOut, ChevronRight, User } from 'lucide-react-native';

export default function SettingsScreen() {
  const [isBioAuthEnabled, setIsBioAuthEnabled] = useState(false);
  const [isPushEnabled, setIsPushEnabled] = useState(true);

  const toggleBioAuth = () => {
    setIsBioAuthEnabled(!isBioAuthEnabled);
    if (!isBioAuthEnabled) {
      Alert.alert(
        "Biometric Authentication",
        "FaceID / TouchID registration completed successfully.",
        [{ text: "OK" }]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Manage your profile, security, and app preferences</Text>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarText}>CI</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Crypto Investor</Text>
            <Text style={styles.profileEmail}>investor@example.com</Text>
          </View>
        </View>

        {/* Security Settings */}
        <Text style={styles.sectionTitle}>Security & Privacy</Text>
        <View style={styles.menuContainer}>
          {/* Biometrics */}
          <View style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Fingerprint size={20} color="#BF5AF2" />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Biometric Login</Text>
              <Text style={styles.menuSub}>Use FaceID / TouchID to unlock</Text>
            </View>
            <Switch
              trackColor={{ false: "#2C2C2E", true: "#00D2FF" }}
              thumbColor={isBioAuthEnabled ? "#FFFFFF" : "#AEAEB2"}
              ios_backgroundColor="#2C2C2E"
              onValueChange={toggleBioAuth}
              value={isBioAuthEnabled}
            />
          </View>

          {/* 2FA */}
          <TouchableOpacity style={styles.menuItemLink}>
            <View style={styles.menuIconContainer}>
              <Shield size={20} color="#30D5C8" />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Two-Factor Auth (2FA)</Text>
              <Text style={styles.menuSub}>Secure withdrawals and transfers</Text>
            </View>
            <ChevronRight size={16} color="#8E8E93" />
          </TouchableOpacity>

          {/* Change PIN */}
          <TouchableOpacity style={styles.menuItemLink}>
            <View style={styles.menuIconContainer}>
              <Lock size={20} color="#FF9F0A" />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Change Security PIN</Text>
              <Text style={styles.menuSub}>Update your 6-digit transaction PIN</Text>
            </View>
            <ChevronRight size={16} color="#8E8E93" />
          </TouchableOpacity>
        </View>

        {/* General Preferences */}
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.menuContainer}>
          {/* Push Notifications */}
          <View style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Eye size={20} color="#00D2FF" />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Push Notifications</Text>
              <Text style={styles.menuSub}>Alerts on deposits and transactions</Text>
            </View>
            <Switch
              trackColor={{ false: "#2C2C2E", true: "#00D2FF" }}
              thumbColor={isPushEnabled ? "#FFFFFF" : "#AEAEB2"}
              ios_backgroundColor="#2C2C2E"
              onValueChange={() => setIsPushEnabled(!isPushEnabled)}
              value={isPushEnabled}
            />
          </View>

          {/* Terms & Policy */}
          <TouchableOpacity style={styles.menuItemLink}>
            <View style={styles.menuIconContainer}>
              <User size={20} color="#8E8E93" />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Terms of Service</Text>
              <Text style={styles.menuSub}>Legal details and privacy policy</Text>
            </View>
            <ChevronRight size={16} color="#8E8E93" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton}>
          <LogOut size={20} color="#FF453A" style={styles.logoutIcon} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121214',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 24,
  },
  profileCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3A3A3C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 20,
  },
  profileInfo: {
    marginLeft: 20,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  profileEmail: {
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  menuContainer: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    paddingVertical: 8,
    marginBottom: 30,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  menuItemLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#121214',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuInfo: {
    flex: 1,
    marginLeft: 16,
  },
  menuTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  menuSub: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 2,
  },
  logoutButton: {
    borderColor: '#FF453A30',
    borderWidth: 1,
    backgroundColor: '#FF453A10',
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 10,
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutText: {
    color: '#FF453A',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
