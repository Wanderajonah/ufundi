import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../components/ScreenWrapper';
import PrimaryButton from '../components/PrimaryButton';
import PhoneInput from '../components/PhoneInput';
import theme from '../theme';
import { formatUgx } from '../utils/ratings';
import { canProceedToPayment } from '../utils/bookings';
import { getPlatformPricing } from '../../services/api';
import { holdEscrow as holdPaymentApi, getWallet } from '../../services/walletApi';
import { useLanguage } from '../i18n/LanguageContext';

const METHODS = [
  { key: 'wallet', name: 'Pay with Wallet', icon: null, phoneLabel: '', hint: 'Pay directly from your wallet balance.' },
];

export default function PaymentScreen({ booking = {}, onBack, onPay, loading = false, onNavigate }) {
  const { t } = useLanguage();
  const [method, setMethod] = useState('wallet');
  const [phone, setPhone] = useState('');
  const [clientFeeRate, setClientFeeRate] = useState(10);
  const [processing, setProcessing] = useState(false);
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    let mounted = true;
    getWallet()
      .then((res) => {
        if (mounted && res.data?.wallet) setBalance(res.data.wallet.balance ?? null);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    getPlatformPricing()
      .then((res) => {
        if (mounted && res.data?.clientFeeRate != null) setClientFeeRate(res.data.clientFeeRate);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const fallbackTotal = booking.total || booking.amount || 17600;
  const serviceFee = booking.serviceFee || Math.round(fallbackTotal / (1 + clientFeeRate / 100));
  const platformFee = Math.round(serviceFee * (clientFeeRate / 100));
  const total = booking.total || booking.amount || serviceFee + platformFee;
  const canPay = canProceedToPayment(booking) || booking.paid;
  const isWallet = method === 'wallet';
  const hasSufficientBalance = balance != null && balance >= total;

  const handlePay = async () => {
    if (!booking.id && !booking._id) {
      onPay?.();
      return;
    }
    const bookingId = booking.id || booking._id;
    setProcessing(true);
    try {
      await holdPaymentApi(bookingId);
      onPay?.();
    } catch (error) {
      const serverMsg = error?.response?.data?.message;
      let msg = serverMsg;
      if (!msg && error?.code === 'ECONNABORTED') {
        msg = t('The request timed out. Check your connection and try again.');
      } else if (!msg && !error?.response) {
        msg = t('Cannot reach Ufundi servers. Check your internet connection.');
      } else if (!msg) {
        msg = t('Could not complete the payment. Please try again.');
      }
      if (/insufficient/i.test(msg)) {
        Alert.alert(t('Not enough balance'), msg, [
          { text: t('Cancel'), style: 'cancel' },
          {
            text: t('Deposit now'),
            onPress: () => onNavigate?.('deposit'),
          },
        ]);
      } else if (serverMsg && /already/i.test(serverMsg)) {
        onPay?.();
      } else {
        Alert.alert(t('Payment failed'), msg);
      }
    } finally {
      setProcessing(false);
    }
  };

  const currentMethod = METHODS.find((m) => m.key === method);

  return (
    <ScreenWrapper style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.white} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('Payment')}</Text>
          <View style={{ width: 40 }} />
        </View>

        {!canPay ? (
          <View style={styles.lockBanner}>
            <Ionicons name="lock-closed-outline" size={18} color={theme.colors.accent} />
            <Text style={styles.lockText}>
              {t('Proceed to Payment unlocks once your fundi accepts and you both agree on the price.')}
            </Text>
          </View>
        ) : null}

        <View style={styles.summary}>
          <Text style={styles.summaryName}>{booking.artisanName || t('Fundi')} · {booking.service || t('Service')}</Text>
          <Text style={styles.summaryMeta}>{booking.date || 'Sat, Apr 27'} · {booking.time || '09:00 AM'}</Text>
          <Text style={styles.summaryLoc}>
            {typeof booking.address === 'string' && booking.address
              ? booking.address
              : typeof booking.location === 'string' && booking.location
                ? booking.location
                : 'Plot 14 Bukoto St'}
          </Text>
          <Text style={styles.total}>UGX {total.toLocaleString()}</Text>
        </View>

        <Text style={styles.section}>{t('PAYMENT METHOD')}</Text>
        {METHODS.map((m) => {
          const selected = method === m.key;
          return (
            <TouchableOpacity
              key={m.key}
              style={[styles.methodCard, selected && styles.methodOn]}
              onPress={() => setMethod(m.key)}
              activeOpacity={0.7}
            >
              <View style={styles.methodLeft}>
                {m.icon ? (
                  <Image source={m.icon} style={styles.methodIcon} resizeMode="contain" />
                ) : (
                  <View style={styles.walletIcon}>
                    <Ionicons name="wallet-outline" size={22} color={selected ? theme.colors.accent : theme.colors.muted} />
                  </View>
                )}
                <View>
                  <Text style={styles.methodName}>{t(m.name)}</Text>
                  {m.key === 'wallet' && balance != null ? (
                    <Text style={[styles.methodBalance, hasSufficientBalance ? styles.balanceOk : styles.balanceLow]}>
                      {t('Balance')}: {formatUgx(balance)}
                    </Text>
                  ) : null}
                </View>
              </View>
              {selected ? (
                <View style={styles.tickWrap}>
                  <Ionicons name="checkmark-circle" size={22} color={theme.colors.accent} />
                </View>
              ) : (
                <View style={styles.radio} />
              )}
            </TouchableOpacity>
          );
        })}

        <View style={styles.escrow}>
          <Ionicons name="lock-closed-outline" size={14} color={theme.colors.muted} />
          <Text style={styles.escrowText}> {t('Funds held in escrow until job is confirmed complete.')}</Text>
        </View>

        {!isWallet ? (
          <>
            <PhoneInput
              label={t(currentMethod?.phoneLabel || 'PHONE NUMBER')}
              value={phone}
              onChangeText={setPhone}
              placeholder="7XX XXX XXX"
            />
            <Text style={styles.hint}>{t(currentMethod?.hint || '')}</Text>
          </>
        ) : (
          <View style={styles.walletHint}>
            <Ionicons name="information-circle-outline" size={14} color={theme.colors.muted} />
            <Text style={styles.hintText}> {t('The total amount will be deducted from your wallet balance.')}</Text>
          </View>
        )}

        <View style={styles.breakdown}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('Service (2hrs est.)')}</Text>
            <Text style={styles.rowVal}>{formatUgx(serviceFee)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('Platform fee ({{rate}}%)', { rate: clientFeeRate })}</Text>
            <Text style={styles.rowVal}>{formatUgx(platformFee)}</Text>
          </View>
          <View style={[styles.row, styles.rowTotal]}>
            <Text style={styles.totalLabel}>{t('Total')}</Text>
            <Text style={styles.totalVal}>UGX {total.toLocaleString()}</Text>
          </View>
          {balance != null ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t('Wallet balance')}</Text>
              <Text
                style={[
                  styles.rowVal,
                  { color: balance >= total ? theme.colors.green : theme.colors.red },
                ]}
              >
                {formatUgx(balance)}
              </Text>
            </View>
          ) : null}
        </View>

        <PrimaryButton
          onPress={handlePay}
          disabled={!canPay || loading || processing || (isWallet && !hasSufficientBalance)}
        >
          {processing
            ? t('Processing…')
            : isWallet
              ? t('Pay from Wallet · UGX {{amount}}', { amount: total.toLocaleString() })
              : t('Proceed to Payment · UGX {{amount}}', { amount: total.toLocaleString() })}
        </PrimaryButton>
        {!canPay ? (
          <Text style={styles.disabledHint}>{t('Complete price negotiation to enable payment.')}</Text>
        ) : isWallet && !hasSufficientBalance ? (
          <Text style={styles.disabledHint}>{t('Insufficient wallet balance. Please deposit first.')}</Text>
        ) : null}
        {loading ? <ActivityIndicator color={theme.colors.accent} style={{ marginTop: 12 }} /> : null}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.black },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
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
  title: { color: theme.colors.white, fontSize: 18, fontWeight: '800' },
  summary: {
    backgroundColor: theme.colors.input,
    borderRadius: theme.radius.lg,
    padding: 16,
    marginBottom: 20,
  },
  summaryName: { color: theme.colors.white, fontWeight: '800', fontSize: 15 },
  summaryMeta: { color: theme.colors.muted, fontSize: 12, marginTop: 4 },
  summaryLoc: { color: theme.colors.muted, fontSize: 12, marginTop: 2 },
  total: { color: theme.colors.accent, fontWeight: '900', fontSize: 22, marginTop: 12 },
  section: {
    color: theme.colors.muted,
    fontSize: theme.typography.caps,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.input,
    borderRadius: theme.radius.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  methodOn: { borderColor: theme.colors.accent, backgroundColor: 'rgba(255,184,0,0.08)' },
  methodLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  methodIcon: { width: 40, height: 40, borderRadius: 10 },
  walletIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,184,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodName: { color: theme.colors.white, fontWeight: '700' },
  methodBalance: { fontSize: 11, marginTop: 2 },
  balanceOk: { color: theme.colors.green },
  balanceLow: { color: theme.colors.red },
  tickWrap: { marginLeft: 8 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.mutedDark,
  },
  escrow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.input,
    padding: 12,
    borderRadius: theme.radius.md,
    marginBottom: 16,
  },
  escrowText: { color: theme.colors.muted, fontSize: 12, lineHeight: 18 },
  walletHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  hintText: { color: theme.colors.muted, fontSize: 12 },
  hint: { color: theme.colors.mutedDark, fontSize: 12, marginTop: -8, marginBottom: 20 },
  breakdown: { marginBottom: 24 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  rowLabel: { color: theme.colors.muted, fontSize: 13 },
  rowVal: { color: theme.colors.white, fontWeight: '600' },
  rowTotal: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.border },
  totalLabel: { color: theme.colors.white, fontWeight: '800' },
  totalVal: { color: theme.colors.accent, fontWeight: '900', fontSize: 18 },
  lockBanner: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,184,0,0.1)',
    borderRadius: theme.radius.md,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.2)',
  },
  lockText: { flex: 1, color: theme.colors.muted, fontSize: 12, lineHeight: 18 },
  disabledHint: { color: theme.colors.mutedDark, fontSize: 12, textAlign: 'center', marginTop: 10 },
});
