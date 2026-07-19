import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, Dimensions } from 'react-native';
import { ArrowDownLeft, ArrowUpRight, Wallet, TrendingUp, ChevronRight, Award } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>Crypto Investor 👋</Text>
          </View>
          <TouchableOpacity style={styles.avatarButton}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>CI</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Balance Card (Sleek Glassmorphism Concept) */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceTitle}>Total Asset Value</Text>
          <Text style={styles.balanceValue}>$15,245.89</Text>
          <View style={styles.changeContainer}>
            <TrendingUp size={16} color="#30D5C8" />
            <Text style={styles.changeText}>+12.4% (24h)</Text>
          </View>

          {/* Quick Actions */}
          <View style={styles.actionContainer}>
            <TouchableOpacity style={styles.actionButton}>
              <View style={styles.actionIconContainer}>
                <ArrowDownLeft size={20} color="#00D2FF" />
              </View>
              <Text style={styles.actionLabel}>Deposit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <View style={styles.actionIconContainer}>
                <ArrowUpRight size={20} color="#FF9F0A" />
              </View>
              <Text style={styles.actionLabel}>Withdraw</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <View style={styles.actionIconContainer}>
                <Wallet size={20} color="#BF5AF2" />
              </View>
              <Text style={styles.actionLabel}>Sweep</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Asset List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Assets</Text>
        </View>

        <View style={styles.assetList}>
          {/* BNB */}
          <View style={styles.assetItem}>
            <View style={[styles.assetIcon, { backgroundColor: '#F0B90B' }]}>
              <Text style={styles.assetIconText}>BNB</Text>
            </View>
            <View style={styles.assetInfo}>
              <Text style={styles.assetName}>BNB</Text>
              <Text style={styles.assetSub}>Binance Coin</Text>
            </View>
            <View style={styles.assetValueContainer}>
              <Text style={styles.assetBalance}>1.45 BNB</Text>
              <Text style={styles.assetUsdValue}>$870.00</Text>
            </View>
          </View>

          {/* USDT */}
          <View style={styles.assetItem}>
            <View style={[styles.assetIcon, { backgroundColor: '#26A17B' }]}>
              <Text style={styles.assetIconText}>USDT</Text>
            </View>
            <View style={styles.assetInfo}>
              <Text style={styles.assetName}>USDT</Text>
              <Text style={styles.assetSub}>Tether</Text>
            </View>
            <View style={styles.assetValueContainer}>
              <Text style={styles.assetBalance}>10,500.00 USDT</Text>
              <Text style={styles.assetUsdValue}>$10,500.00</Text>
            </View>
          </View>

          {/* MYTOKEN */}
          <View style={styles.assetItem}>
            <View style={[styles.assetIcon, { backgroundColor: '#BF5AF2' }]}>
              <Text style={styles.assetIconText}>MYT</Text>
            </View>
            <View style={styles.assetInfo}>
              <Text style={styles.assetName}>MYTOKEN</Text>
              <Text style={styles.assetSub}>Platform Native Token</Text>
            </View>
            <View style={styles.assetValueContainer}>
              <Text style={styles.assetBalance}>387,589.00 MYT</Text>
              <Text style={styles.assetUsdValue}>$3,875.89</Text>
            </View>
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity style={styles.seeAllButton}>
            <Text style={styles.seeAllText}>See All</Text>
            <ChevronRight size={14} color="#00D2FF" />
          </TouchableOpacity>
        </View>

        <View style={styles.txContainer}>
          <View style={styles.txItem}>
            <View style={styles.txIconContainer}>
              <ArrowDownLeft size={16} color="#30D5C8" />
            </View>
            <View style={styles.txInfo}>
              <Text style={styles.txTitle}>USDT Deposit</Text>
              <Text style={styles.txTime}>Today, 14:24</Text>
            </View>
            <View style={styles.txAmountContainer}>
              <Text style={[styles.txAmount, { color: '#30D5C8' }]}>+500.00 USDT</Text>
              <Text style={styles.txStatus}>Completed</Text>
            </View>
          </View>

          <View style={styles.txItem}>
            <View style={styles.txIconContainer}>
              <ArrowUpRight size={16} color="#FF453A" />
            </View>
            <View style={styles.txInfo}>
              <Text style={styles.txTitle}>MYTOKEN Swap Out</Text>
              <Text style={styles.txTime}>Yesterday, 18:02</Text>
            </View>
            <View style={styles.txAmountContainer}>
              <Text style={[styles.txAmount, { color: '#FF9F0A' }]}>-10,000.00 MYT</Text>
              <Text style={styles.txStatus}>Completed</Text>
            </View>
          </View>
        </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  welcomeText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 4,
  },
  avatarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2E',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3A3A3C',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  balanceCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: 30,
  },
  balanceTitle: {
    fontSize: 13,
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  balanceValue: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  changeText: {
    color: '#30D5C8',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 24,
    borderTopWidth: 1,
    borderColor: '#2C2C2E',
    paddingTop: 20,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    color: '#00D2FF',
    fontSize: 14,
    marginRight: 4,
  },
  assetList: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    marginBottom: 30,
  },
  assetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  assetIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  assetIconText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 11,
  },
  assetInfo: {
    flex: 1,
    marginLeft: 16,
  },
  assetName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  assetSub: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  assetValueContainer: {
    alignItems: 'end',
  },
  assetBalance: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'right',
  },
  assetUsdValue: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
    textAlign: 'right',
  },
  txContainer: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  txIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  txInfo: {
    flex: 1,
    marginLeft: 16,
  },
  txTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  txTime: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  txAmountContainer: {
    alignItems: 'end',
  },
  txAmount: {
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  txStatus: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
    textAlign: 'right',
  },
});
