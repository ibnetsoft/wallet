import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, Clipboard } from 'react-native';
import { Share2, Users, Award, Copy, Check } from 'lucide-react-native';

export default function NetworkScreen() {
  const [copied, setCopied] = React.useState(false);
  const referralCode = 'REF-883719';

  const copyToClipboard = () => {
    Clipboard.setString(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>My Network</Text>
        <Text style={styles.subtitle}>Track your referral downlines and bonus performance</Text>

        {/* Share Section */}
        <View style={styles.referralCard}>
          <Text style={styles.cardHeader}>My Referral Code</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeText}>{referralCode}</Text>
            <TouchableOpacity style={styles.copyBtn} onPress={copyToClipboard}>
              {copied ? <Check size={18} color="#30D5C8" /> : <Copy size={18} color="#00D2FF" />}
            </TouchableOpacity>
          </View>
          <Text style={styles.cardDesc}>Share this code with your friends to earn up to 5% bonus</Text>
          <TouchableOpacity style={styles.shareBtn}>
            <Share2 size={16} color="#FFFFFF" style={styles.shareIcon} />
            <Text style={styles.shareBtnText}>Invite Friends</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Users size={20} color="#00D2FF" />
            <Text style={styles.statVal}>42</Text>
            <Text style={styles.statLabel}>Total Members</Text>
          </View>
          <View style={styles.statBox}>
            <Award size={20} color="#BF5AF2" />
            <Text style={styles.statVal}>$1,240.00</Text>
            <Text style={styles.statLabel}>Accumulated Bonus</Text>
          </View>
        </View>

        {/* Downline Tree Visualization (Mock) */}
        <Text style={styles.sectionTitle}>Downline Tree</Text>
        <View style={styles.treeContainer}>
          {/* Level 0: Self */}
          <View style={styles.treeNodeSelf}>
            <Text style={styles.nodeSelfTitle}>Me (You)</Text>
            <Text style={styles.nodeSelfSub}>Lvl 0</Text>
          </View>

          {/* Connective Line */}
          <View style={styles.connectiveLine} />

          {/* Level 1: Immediate children */}
          <View style={styles.childrenRow}>
            {/* Child A */}
            <View style={styles.treeNode}>
              <Text style={styles.nodeTitle}>User_Alpha</Text>
              <Text style={styles.nodeSub}>Lvl 1 | 24 Active</Text>
              <View style={styles.subConnector} />
            </View>

            {/* Child B */}
            <View style={styles.treeNode}>
              <Text style={styles.nodeTitle}>User_Beta</Text>
              <Text style={styles.nodeSub}>Lvl 1 | 18 Active</Text>
              <View style={styles.subConnector} />
            </View>
          </View>
        </View>

        {/* Member list details */}
        <Text style={styles.sectionTitle}>Recent Joins</Text>
        <View style={styles.listContainer}>
          <View style={styles.listItem}>
            <View style={styles.avatarMini}>
              <Text style={styles.avatarMiniText}>UA</Text>
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>User_Alpha</Text>
              <Text style={styles.itemDate}>Joined 2 days ago</Text>
            </View>
            <Text style={styles.itemStatus}>Lvl 1</Text>
          </View>

          <View style={styles.listItem}>
            <View style={styles.avatarMini}>
              <Text style={styles.avatarMiniText}>UB</Text>
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>User_Beta</Text>
              <Text style={styles.itemDate}>Joined 5 days ago</Text>
            </View>
            <Text style={styles.itemStatus}>Lvl 1</Text>
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
  referralCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardHeader: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: '#121214',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  codeText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 12,
    letterSpacing: 1,
  },
  copyBtn: {
    padding: 4,
  },
  cardDesc: {
    color: '#8E8E93',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },
  shareBtn: {
    backgroundColor: '#00D2FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginTop: 16,
    width: '100%',
  },
  shareIcon: {
    marginRight: 8,
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  statBox: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    padding: 16,
    width: '48%',
    alignItems: 'center',
  },
  statVal: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  treeContainer: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    padding: 24,
    alignItems: 'center',
    marginBottom: 30,
  },
  treeNodeSelf: {
    backgroundColor: '#00D2FF20',
    borderColor: '#00D2FF',
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    width: 140,
  },
  nodeSelfTitle: {
    color: '#00D2FF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  nodeSelfSub: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 2,
  },
  connectiveLine: {
    width: 2,
    height: 30,
    backgroundColor: '#2C2C2E',
  },
  childrenRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  treeNode: {
    backgroundColor: '#121214',
    borderColor: '#2C2C2E',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    width: '45%',
  },
  nodeTitle: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  nodeSub: {
    color: '#8E8E93',
    fontSize: 10,
    marginTop: 2,
  },
  subConnector: {
    position: 'absolute',
    top: -10,
    left: '50%',
    width: 2,
    height: 10,
    backgroundColor: '#2C2C2E',
  },
  listContainer: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  avatarMini: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarMiniText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  itemDate: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 2,
  },
  itemStatus: {
    color: '#00D2FF',
    fontWeight: '600',
    fontSize: 12,
  },
});
