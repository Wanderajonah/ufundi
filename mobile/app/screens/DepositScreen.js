import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { fc, fundiCardShadow } from '../fundiTheme';
import ScreenWrapper from '../components/ScreenWrapper';
import FundiThemedScreen from '../components/FundiThemedScreen';
import PrimaryButton from '../components/PrimaryButton';
import { getWallet, deposit } from '../../services/walletApi';
import { useLanguage } from '../i18n/LanguageContext';

const PRESETS = [10000, 20000, 50000, 100000, 200000, 500000];

const METHODS = [
  {
    key: 'mtn',
    label: 'MTN Mobile Money',
    phoneLabel: 'MoMo Number',
    phonePlaceholder: '77X XXX XXX',
    logo: require('../../assets/mtn.png'),
    bg: '#FFCB01',
    contain: false,
  },
  {
    key: 'airtel',
    label: 'Airtel Money',
    phoneLabel: 'Airtel Number',
    phonePlaceholder: '70X XXX XXX',
    logo: require('../../assets/airtel.png'),
    bg: '#FFFFFF',
    contain: true,
  },
];

export default function DepositScreen({ onNavigate, userRole = 'customer' }) {
  const isFundi = userRole === 'fundi';
  const { t } = useLanguage();
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState('mtn');
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await getWallet();
        if (!cancelled) setWallet(data.wallet);
      } catch {
        // balance is optional context; ignore failures
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const numericAmount = Number(amount.replace(/,/g, '')) || 0;
  const currency = wallet?.currency || 'UGX';
  const cleanPhone = phone.replace(/\D/g, '');
  const phoneValid = cleanPhone.length === 9;
  const selectedMethod = METHODS.find((m) => m.key === method);

  const formatAmount = (val) => `${currency} ${Number(val || 0).toLocaleString()}`;

  const handlePreset = (val) => setAmount(val.toLocaleString());

  const handleDeposit = async () => {
    if (numericAmount <= 0) return Alert.alert(t('Enter amount'), t('Please enter the amount you want to deposit.'));
    if (!phoneValid) return Alert.alert(t('Invalid number'), t('Enter a valid 9-digit {{method}} number (e.g. 7XX XXX XXX).', { method: selectedMethod.label }));

    setLoading(true);
    try {
      const { data } = await deposit(
        numericAmount,
        method === 'mtn' ? 'mtn_momo' : 'airtel_money',
        `+256${cleanPhone}`,
      );
      Alert.alert(
        t('Deposit Successful'),
        t('{{amount}} was added to your wallet.\n\nNew balance: {{balance}}', {
          amount: formatAmount(numericAmount),
          balance: formatAmount(data.balance),
        }),
        [{ text: t('OK'), onPress: () => onNavigate?.('wallet') }],
      );
    } catch (error) {
      Alert.alert(t('Deposit failed'), error.response?.data?.message || t('Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {!isFundi ? (
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => onNavigate?.('wallet')}>
            <Ionicons name="chevron-back" size={20} color={theme.colors.white} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('Deposit')}</Text>
          <View style={{ width: 40 }} />
        </View>
      ) : null}

      {wallet ? (
        <View style={[styles.balanceRow, isFundi && styles.fundiBalanceRow]}>
          <View style={styles.balanceIcon}>
            <Ionicons name="wallet-outline" size={18} color={theme.colors.accent} />
          </View>
          <Text style={[styles.balanceLabel, isFundi && styles.fundiTextMuted]}>{t('Available balance')}</Text>
          <Text style={[styles.balanceValue, isFundi && styles.fundiBalanceValue]}>{formatAmount(wallet.balance)}</Text>
        </View>
      ) : null}

      <Text style={[styles.section, isFundi && styles.fundiSection]}>{t('Payment Method')}</Text>
      {METHODS.map((m) => {
        const selected = method === m.key;
        return (
          <TouchableOpacity
            key={m.key}
            style={[styles.methodCard, isFundi && styles.fundiCard, selected && styles.methodOn]}
            activeOpacity={0.8}
            onPress={() => setMethod(m.key)}
          >
            <View style={styles.methodLeft}>
              <View style={[styles.logo, { backgroundColor: m.bg }]}>
                <Image
                  source={m.logo}
                  style={styles.logoImage}
                  resizeMode={m.contain ? 'contain' : 'cover'}
                />
              </View>
              <Text style={[styles.methodName, isFundi && styles.fundiText]}>{t(m.label)}</Text>
            </View>
            <Ionicons
              name={selected ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={selected ? theme.colors.accent : isFundi ? fc.textSubtle : theme.colors.mutedDark}
            />
          </TouchableOpacity>
        );
      })}

      <Text style={[styles.section, isFundi && styles.fundiSection]}>{t('Amount')}</Text>
      <View style={[styles.amountCard, isFundi && styles.fundiInputCard]}>
        <Text style={styles.currencyPrefix}>{currency}</Text>
        <TextInput
          style={[styles.amountInput, isFundi && styles.fundiText]}
          value={amount}
          onChangeText={setAmount}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={isFundi ? fc.textSubtle : theme.colors.mutedDark}
        />
      </View>

      <View style={styles.presets}>
        {PRESETS.map((p) => {
          const active = numericAmount === p;
          return (
            <TouchableOpacity
              key={p}
              style={[styles.presetBtn, isFundi && styles.fundiPresetBtn, active && styles.presetOn]}
              activeOpacity={0.85}
              onPress={() => handlePreset(p)}
            >
              <Text style={[styles.presetText, isFundi && styles.fundiPresetText, active && styles.presetTextOn]}>
                {currency} {p.toLocaleString()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.section, isFundi && styles.fundiSection]}>{t(selectedMethod.phoneLabel)}</Text>
      <View style={[styles.phoneInput, isFundi && styles.fundiInputCard]}>
        <Text style={[styles.phonePrefix, isFundi && styles.fundiTextMuted]}>+256</Text>
        <TextInput
          style={[styles.phoneField, isFundi && styles.fundiText]}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder={selectedMethod.phonePlaceholder}
          placeholderTextColor={isFundi ? fc.textSubtle : theme.colors.mutedDark}
          maxLength={9}
        />
      </View>
      <Text style={[styles.hint, isFundi && styles.fundiHint]}>
        {t('Enter the {{method}} number to receive the deposit from. Your wallet is credited instantly.', {
          method: selectedMethod.key === 'mtn' ? 'MTN MoMo' : 'Airtel Money',
        })}
      </Text>

      <PrimaryButton
        onPress={handleDeposit}
        loading={loading}
        disabled={numericAmount <= 0}
      >
        {numericAmount > 0 ? t('Deposit {{amount}}', { amount: formatAmount(numericAmount) }) : t('Enter an amount')}
      </PrimaryButton>
    </ScrollView>
  );

  if (isFundi) {
    return (
      <FundiThemedScreen title={t('Deposit')} onBack={() => onNavigate?.('wallet')}>
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
  scroll: { paddingHorizontal: 16, paddingBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.input,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { color: theme.colors.white, fontSize: 18, fontWeight: '900' },

  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.panel,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  balanceIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(255,184,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceLabel: { color: theme.colors.muted, fontSize: 13, flex: 1 },
  balanceValue: { color: theme.colors.white, fontWeight: '900', fontSize: 15 },

  section: {
    color: theme.colors.mutedDark,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 4,
  },

  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.input,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  methodOn: { borderColor: theme.colors.accent, backgroundColor: 'rgba(255,184,0,0.06)' },
  methodLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  logoImage: { width: '100%', height: '100%' },
  methodName: { color: theme.colors.white, fontWeight: '700', fontSize: 14 },

  amountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.input,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  currencyPrefix: { color: theme.colors.accent, fontWeight: '800', fontSize: 16, marginRight: 10 },
  amountInput: { color: theme.colors.white, fontSize: 22, fontWeight: '800', flex: 1, padding: 0 },

  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  presetBtn: {
    backgroundColor: theme.colors.input,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  presetOn: { borderColor: theme.colors.accent, backgroundColor: 'rgba(255,184,0,0.08)' },
  presetText: { color: theme.colors.muted, fontWeight: '700', fontSize: 12 },
  presetTextOn: { color: theme.colors.accent },

  phoneInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.input,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  phonePrefix: { color: theme.colors.mutedDark, fontWeight: '700', fontSize: 16, marginRight: 8 },
  phoneField: { color: theme.colors.white, fontSize: 16, fontWeight: '700', flex: 1, padding: 0 },
  hint: { color: theme.colors.mutedDark, fontSize: 12, marginBottom: 24 },

  fundiText: { color: fc.text },
  fundiTextMuted: { color: fc.textMuted },
  fundiSection: { color: fc.textMuted },
  fundiHint: { color: fc.textMuted },
  fundiBalanceRow: {
    backgroundColor: fc.card,
    borderColor: fc.border,
    ...fundiCardShadow,
  },
  fundiBalanceValue: { color: fc.text },
  fundiCard: { backgroundColor: fc.card, borderColor: fc.border },
  fundiInputCard: { backgroundColor: fc.card, borderColor: fc.border },
  fundiPresetBtn: { backgroundColor: fc.card, borderColor: fc.border },
  fundiPresetText: { color: fc.textMuted },
});
