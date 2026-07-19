import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { ArrowDown, RefreshCw, Info } from 'lucide-react-native';

export default function SwapScreen() {
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [isUsdtToToken, setIsUsdtToToken] = useState(true);

  // Simple mock conversion (1 USDT = 100 MYT)
  const handleFromAmountChange = (text: string) => {
    setFromAmount(text);
    if (!text || isNaN(Number(text))) {
      setToAmount('');
      return;
    }
    const num = Number(text);
    if (isUsdtToToken) {
      setToAmount((num * 100).toFixed(2));
    } else {
      setToAmount((num / 100).toFixed(4));
    }
  };

  const handleSwapDirection = () => {
    setIsUsdtToToken(!isUsdtToToken);
    setFromAmount('');
    setToAmount('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Token Swap</Text>
          <Text style={styles.subtitle}>Swap your assets instantly with low fees</Text>

          {/* Swap Box */}
          <View style={styles.swapBox}>
            {/* From Asset */}
            <View style={styles.inputContainer}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>From</Text>
                <Text style={styles.balanceLabel}>
                  Balance: {isUsdtToToken ? '10,500.00 USDT' : '387,589.00 MYT'}
                </Text>
              </View>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.textInput}
                  placeholder="0.0"
                  placeholderTextColor="#48484A"
                  keyboardType="numeric"
                  value={fromAmount}
                  onChangeText={handleFromAmountChange}
                />
                <View style={[styles.assetSelector, isUsdtToToken ? styles.usdtBg : styles.mytBg]}>
                  <Text style={styles.assetSelectorText}>{isUsdtToToken ? 'USDT' : 'MYTOKEN'}</Text>
                </View>
              </View>
            </View>

            {/* Swap Divider Button */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <TouchableOpacity style={styles.swapIconButton} onPress={handleSwapDirection}>
                <ArrowDown size={20} color="#00D2FF" />
              </TouchableOpacity>
              <View style={styles.dividerLine} />
            </View>

            {/* To Asset */}
            <View style={styles.inputContainer}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>To</Text>
                <Text style={styles.balanceLabel}>
                  Balance: {isUsdtToToken ? '387,589.00 MYT' : '10,500.00 USDT'}
                </Text>
              </View>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.textInput, styles.disabledInput]}
                  placeholder="0.0"
                  placeholderTextColor="#48484A"
                  editable={false}
                  value={toAmount}
                />
                <View style={[styles.assetSelector, isUsdtToToken ? styles.mytBg : styles.usdtBg]}>
                  <Text style={styles.assetSelectorText}>{isUsdtToToken ? 'MYTOKEN' : 'USDT'}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Details & Info */}
          <View style={styles.detailsBox}>
            <View style={styles.detailRow}>
              <View style={styles.detailTitleContainer}>
                <Info size={14} color="#8E8E93" style={styles.infoIcon} />
                <Text style={styles.detailLabel}>Exchange Rate</Text>
              </View>
              <Text style={styles.detailValue}>
                {isUsdtToToken ? '1 USDT = 100 MYT' : '1 MYT = 0.01 USDT'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Slippage Tolerance</Text>
              <Text style={styles.detailValue}>0.5%</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Network Fee (Gas)</Text>
              <Text style={styles.detailValue}>~0.001 BNB ($0.60)</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Slippage Fee (Platform)</Text>
              <Text style={styles.detailValue}>0.2%</Text>
            </View>
          </View>

          {/* Swap Button */}
          <TouchableOpacity 
            style={[styles.swapButton, !fromAmount && styles.disabledSwapButton]}
            disabled={!fromAmount}
          >
            <RefreshCw size={20} color="#FFFFFF" style={styles.btnIcon} />
            <Text style={styles.swapButtonText}>Swap Now</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121214',
  },
  keyboardContainer: {
    flex: 1,
  },
  content: {
    padding: 20,
    flex: 1,
    justifyContent: 'center',
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
    marginBottom: 30,
  },
  swapBox: {
    backgroundColor: '#1C1C1E',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 5,
  },
  inputContainer: {
    backgroundColor: '#121214',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  inputLabel: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
  },
  balanceLabel: {
    color: '#8E8E93',
    fontSize: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textInput: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    padding: 0,
  },
  disabledInput: {
    color: '#AEAEB2',
  },
  assetSelector: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginLeft: 12,
  },
  usdtBg: {
    backgroundColor: '#26A17B',
  },
  mytBg: {
    backgroundColor: '#BF5AF2',
  },
  assetSelectorText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2C2C2E',
  },
  swapIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  detailsBox: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  detailTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    marginRight: 6,
  },
  detailLabel: {
    color: '#8E8E93',
    fontSize: 13,
  },
  detailValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  swapButton: {
    backgroundColor: '#00D2FF',
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 30,
    shadowColor: '#00D2FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledSwapButton: {
    backgroundColor: '#2C2C2E',
    shadowOpacity: 0,
    elevation: 0,
  },
  btnIcon: {
    marginRight: 8,
  },
  swapButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
