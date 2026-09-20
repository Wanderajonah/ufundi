import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { fc, fundiCardShadow } from '../fundiTheme';
import ScreenWrapper from '../components/ScreenWrapper';
import FundiThemedScreen from '../components/FundiThemedScreen';
import PrimaryButton from '../components/PrimaryButton';
import { getWallet, transfer } from '../../services/walletApi';
import { useLanguage } from '../i18n/LanguageContext';

export default function TransferScreen({ onNavigate, userRole = 'customer' }) {
  const isFundi = userRole === 'fundi';
  const { t } = useLanguage();
  const [amount, setAmount] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
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

  const handleTransfer = async () => {
    if (numericAmount <= 0) return Alert.alert(t('Error'), t('Enter an amount'));
    if (numericAmount > balance) return Alert.alert(t('Error'), t('Insufficient balance'));
    if (!recipientPhone.trim()) return Alert.alert(t('Error'), t('Enter recipient phone number'));

    const phone = recipientPhone.replace(/^0+/, '').replace(/[^0-9]/g, '');
    if (phone.length < 8) return Alert.alert(t('Error'), t('Enter a valid phone number'));

    setLoading(true);
    try {
      const { data } = await transfer(numericAmount, `256${phone}`);
      Alert.alert(t('Success'), t('UGX {{amount}} transferred successfully!', { amount: numericAmount.toLocaleString() }), [
        { text: t('OK'), onPress: () => onNavigate?.('wallet') },
      ]);
    } catch (error) {
      Alert.alert(t('Transfer Failed'), error.response?.data?.message || t('Something went wrong'));
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
          <Text style={styles.title}>{t('Transfer')}</Text>
          <View style={{ width: 40 }} />
        </View>
      ) : null}

      <View style={[styles.balanceBanner, isFundi && styles.fundiBalanceBanner]}>
        <Text style={[styles.balanceLabel, isFundi && styles.fundiTextMuted]}>{t('Available Balance')}</Text>
        <Text style={[styles.balanceAmount, isFundi && styles.fundiBalanceAmount]}>{t('UGX {{amount}}', { amount: (balance || 0).toLocaleString() })}</Text>
      </View>

      <Text style={[styles.section, isFundi && styles.fundiSection]}>{t('RECIPIENT')}</Text>
      <View style={[styles.phoneInput, isFundi && styles.fundiInputCard]}>
        <Text style={[styles.phonePrefix, isFundi && styles.fundiTextMuted]}>+256</Text>
        <TextInput
          style={[styles.input, { flex: 1 }, isFundi && styles.fundiInput]}
          value={recipientPhone}
          onChangeText={setRecipientPhone}
          keyboardType="phone-pad"
          placeholder="7XX XXX XXX"
          placeholderTextColor={isFundi ? fc.textSubtle : theme.colors.mutedDark}
        />
      </View>
      <Text style={[styles.hint, isFundi && styles.fundiHint]}>{t('Enter the phone number of the Ufundi user to send funds to.')}</Text>

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

      <PrimaryButton onPress={handleTransfer} disabled={loading || numericAmount <= 0 || numericAmount > balance}>
        {loading ? t('Processing...') : t('Transfer UGX {{amount}}', { amount: numericAmount.toLocaleString() })}
      </PrimaryButton>
      {loading ? <ActivityIndicator color={theme.colors.accent} style={{ marginTop: 12 }} /> : null}
    </ScrollView>
  );

  if (isFundi) {
    return (
      <FundiThemedScreen title={t('Transfer')} onBack={() => onNavigate?.('wallet')}>
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
  phoneInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.input, borderRadius: theme.radius.md, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  phonePrefix: { color: theme.colors.mutedDark, fontWeight: '700', fontSize: 16, marginRight: 8 },
  input: { color: theme.colors.white, fontSize: 18, fontWeight: '800', flex: 1 },
  amountInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.input, borderRadius: theme.radius.md, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: theme.colors.border },
  currency: { color: theme.colors.accent, fontWeight: '900', fontSize: 18, marginRight: 10 },
  hint: { color: theme.colors.mutedDark, fontSize: 12, marginBottom: 16, marginTop: -4 },

  fundiText: { color: fc.text },
  fundiTextMuted: { color: fc.textMuted },
  fundiSection: { color: fc.textMuted },
  fundiHint: { color: fc.textMuted },
  fundiInputCard: { backgroundColor: fc.card, borderColor: fc.border, ...fundiCardShadow },
  fundiInput: { color: fc.text },
  fundiBalanceBanner: { backgroundColor: fc.card, borderColor: fc.border, ...fundiCardShadow },
  fundiBalanceAmount: { color: fc.accentDark },
});
