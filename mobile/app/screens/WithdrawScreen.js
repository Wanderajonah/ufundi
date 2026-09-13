import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { fc, fundiCardShadow } from '../fundiTheme';
import ScreenWrapper from '../components/ScreenWrapper';
import FundiThemedScreen from '../components/FundiThemedScreen';
import PrimaryButton from '../components/PrimaryButton';
import { getWallet, withdraw } from '../../services/walletApi';
import { useLanguage } from '../i18n/LanguageContext';

const PRESETS = [10000, 20000, 50000, 100000, 200000];

export default function WithdrawScreen({ onNavigate, userRole = 'customer' }) {
  const isFundi = userRole === 'fundi';
  const { t } = useLanguage();
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState('mtn');
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await getWallet();
        setBalance(data.wallet?.balance || 0);
      } catch {}
    })();
  }, []);

  const numericAmount = Number(amount.replace(/,/g, '')) || 0;

  const handlePreset = (val) => setAmount(val.toLocaleString());

  const handleWithdraw = async () => {
    if (numericAmount <= 0) return Alert.alert(t('Error'), t('Enter an amount'));
    if (numericAmount > balance) return Alert.alert(t('Error'), t('Insufficient balance'));
    setLoading(true);
    try {
      const { data } = await withdraw(numericAmount, method === 'mtn' ? 'mtn_momo' : 'airtel_money', phone);
      Alert.alert(t('Success'), t('UGX {{amount}} withdrawn successfully!', { amount: numericAmount.toLocaleString() }), [
        { text: t('OK'), onPress: () => onNavigate?.('wallet') },
      ]);
    } catch (error) {
      Alert.alert(t('Error'), error.response?.data?.message || t('Withdrawal failed'));
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {!isFundi ? (
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => onNavigate?.('wallet')}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.white} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('Withdraw')}</Text>
          <View style={{ width: 40 }} />
        </View>
      ) : null}

      <View style={[styles.balanceBanner, isFundi && styles.fundiBalanceBanner]}>
        <Text style={[styles.balanceLabel, isFundi && styles.fundiTextMuted]}>{t('Available Balance')}</Text>
        <Text style={[styles.balanceAmount, isFundi && styles.fundiBalanceAmount]}>{t('UGX {{amount}}', { amount: (balance || 0).toLocaleString() })}</Text>
      </View>

      <Text style={[styles.section, isFundi && styles.fundiSection]}>{t('WITHDRAW TO')}</Text>
      <TouchableOpacity
        style={[styles.methodCard, isFundi && styles.fundiCard, method === 'mtn' && styles.methodOn]}
        onPress={() => setMethod('mtn')}
      >
        <View style={styles.methodLeft}>
          <View style={[styles.logo, { backgroundColor: '#FFCC00' }]}>
            <Text style={styles.logoText}>MTN</Text>
          </View>
          <Text style={[styles.methodName, isFundi && styles.fundiText]}>{t('MTN Mobile Money')}</Text>
        </View>
        <View style={[styles.radio, method === 'mtn' && styles.radioOn]} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.methodCard, isFundi && styles.fundiCard, method === 'airtel' && styles.methodOn]}
        onPress={() => setMethod('airtel')}
      >
        <View style={styles.methodLeft}>
          <View style={[styles.logo, { backgroundColor: '#E40000' }]}>
            <Text style={[styles.logoText, { color: '#fff' }]}>A</Text>
          </View>
          <Text style={[styles.methodName, isFundi && styles.fundiText]}>{t('Airtel Money')}</Text>
        </View>
        <View style={[styles.radio, method === 'airtel' && styles.radioOn]} />
      </TouchableOpacity>

      <Text style={[styles.section, isFundi && styles.fundiSection]}>{t('AMOUNT')}</Text>
      <View style={[styles.amountInput, isFundi && styles.fundiInputCard]}>
        <Text style={styles.currency}>UGX</Text>
        <TextInput
          style={[styles.input, isFundi && styles.fundiInput]}
          value={amount}
          onChangeText={setAmount}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={isFundi ? fc.textSubtle : theme.colors.mutedDark}
        />
      </View>

      <View style={styles.presets}>
        {PRESETS.map((p) => (
          <TouchableOpacity key={p} style={[styles.presetBtn, isFundi && styles.fundiPresetBtn, numericAmount === p && styles.presetOn]} onPress={() => handlePreset(p)}>
            <Text style={[styles.presetText, isFundi && styles.fundiPresetText, numericAmount === p && styles.presetTextOn]}>UGX {p.toLocaleString()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.section, isFundi && styles.fundiSection]}>{t('MOMO NUMBER')}</Text>
      <View style={[styles.phoneInput, isFundi && styles.fundiInputCard]}>
        <Text style={[styles.phonePrefix, isFundi && styles.fundiTextMuted]}>+256</Text>
        <TextInput
          style={[styles.input, { flex: 1 }, isFundi && styles.fundiInput]}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="7XX XXX XXX"
          placeholderTextColor={isFundi ? fc.textSubtle : theme.colors.mutedDark}
        />
      </View>
      <Text style={[styles.hint, isFundi && styles.fundiHint]}>{t('Funds will be sent to your mobile money wallet.')}</Text>

      <PrimaryButton onPress={handleWithdraw} disabled={loading || numericAmount <= 0 || numericAmount > balance}>
        {loading ? t('Processing...') : t('Withdraw UGX {{amount}}', { amount: numericAmount.toLocaleString() })}
      </PrimaryButton>
      {loading ? <ActivityIndicator color={theme.colors.accent} style={{ marginTop: 12 }} /> : null}
    </ScrollView>
  );

  if (isFundi) {
    return (
      <FundiThemedScreen title={t('Withdraw')} onBack={() => onNavigate?.('wallet')}>
        {content}
      </FundiThemedScreen>
    );
  }

  return (
    <ScreenWrapper style={styles.safe}>
      {content}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.black },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.input, borderWidth: 1, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' },
  title: { color: theme.colors.white, fontSize: 18, fontWeight: '800' },
  balanceBanner: { backgroundColor: theme.colors.panel, borderRadius: 16, padding: 16, marginBottom: 20, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  balanceLabel: { color: theme.colors.muted, fontSize: 12 },
  balanceAmount: { color: theme.colors.accent, fontSize: 24, fontWeight: '900', marginTop: 4 },
  section: { color: theme.colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10, marginTop: 4 },
  methodCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: theme.colors.input, borderRadius: theme.radius.md, padding: 14, marginBottom: 10,
    borderWidth: 2, borderColor: 'transparent',
  },
  methodOn: { borderColor: theme.colors.accent, backgroundColor: 'rgba(255,184,0,0.08)' },
  methodLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  logoText: { fontWeight: '900', fontSize: 11, color: theme.colors.textDark },
  methodName: { color: theme.colors.white, fontWeight: '700' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: theme.colors.mutedDark },
  radioOn: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accent },
  amountInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.input, borderRadius: theme.radius.md, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  currency: { color: theme.colors.accent, fontWeight: '900', fontSize: 18, marginRight: 10 },
  input: { color: theme.colors.white, fontSize: 18, fontWeight: '800', flex: 1 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  presetBtn: { backgroundColor: theme.colors.input, borderRadius: theme.radius.pill, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: theme.colors.border },
  presetOn: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accent },
  presetText: { color: theme.colors.muted, fontWeight: '700', fontSize: 12 },
  presetTextOn: { color: theme.colors.textDark },
  phoneInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.input, borderRadius: theme.radius.md, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  phonePrefix: { color: theme.colors.mutedDark, fontWeight: '700', fontSize: 16, marginRight: 8 },
  hint: { color: theme.colors.mutedDark, fontSize: 12, marginBottom: 24, marginTop: -4 },

  fundiText: { color: fc.text },
  fundiTextMuted: { color: fc.textMuted },
  fundiSection: { color: fc.textMuted },
  fundiHint: { color: fc.textMuted },
  fundiCard: { backgroundColor: fc.card, borderColor: fc.border, ...fundiCardShadow },
  fundiInputCard: { backgroundColor: fc.card, borderColor: fc.border, ...fundiCardShadow },
  fundiInput: { color: fc.text },
  fundiBalanceBanner: { backgroundColor: fc.card, borderColor: fc.border, ...fundiCardShadow },
  fundiBalanceAmount: { color: fc.accentDark },
  fundiPresetBtn: { backgroundColor: fc.card, borderColor: fc.border },
  fundiPresetText: { color: fc.textMuted },
});
