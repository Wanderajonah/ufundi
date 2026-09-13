import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../theme';
import { fc, fundiCardShadow } from '../fundiTheme';
import ScreenWrapper from '../components/ScreenWrapper';
import FundiThemedScreen from '../components/FundiThemedScreen';
import { WalletSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import PrimaryButton from '../components/PrimaryButton';
import { getWallet, getTransactions } from '../../services/walletApi';
import { useLanguage } from '../i18n/LanguageContext';

export default function WalletHomeScreen({ onNavigate, userRole = 'customer' }) {
  const isFundi = userRole === 'fundi';
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [wallet, setWallet] = useState(null);
  const [recentTx, setRecentTx] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hidden, setHidden] = useState(false);

  const load = useCallback(async () => {
    try {
      const [walletRes, txRes] = await Promise.all([
        getWallet(),
        getTransactions({ limit: 5 }),
      ]);
      setWallet(walletRes.data.wallet);
      setRecentTx(txRes.data.transactions || []);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const formatCurrency = (val) =>
    `${wallet?.currency || 'UGX'} ${(val || 0).toLocaleString()}`;

  const maskAmount = (val) => (hidden ? '••••••' : formatCurrency(val));

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-UG', { day: 'numeric', month: 'short' });
  };

  const txIcon = (type) => {
    switch (type) {
      case 'deposit': return 'arrow-down-circle';
      case 'withdrawal': return 'arrow-up-circle';
      case 'payment': return 'cart-outline';
      case 'payment_received': return 'wallet-outline';
      case 'refund': return 'refresh-circle';
      case 'transfer_out': return 'arrow-forward-circle';
      case 'transfer_in': return 'arrow-back-circle';
      default: return 'ellipse-outline';
    }
  };

  const txColor = (type) => {
    if (['deposit', 'payment_received', 'refund', 'transfer_in'].includes(type)) return theme.colors.green;
    return type === 'payment' ? theme.colors.accent : theme.colors.red;
  };

  const quickActions = [
    { key: 'deposit', label: t('Deposit'), icon: 'add-circle-outline', color: theme.colors.green },
    { key: 'withdraw', label: t('Withdraw'), icon: 'cash-outline', color: theme.colors.red },
    { key: 'transfer', label: t('Transfer'), icon: 'swap-horizontal-outline', color: theme.colors.blue },
    { key: 'history', label: t('History'), icon: 'time-outline', color: theme.colors.accent },
  ];

  const pageTitle = isFundi ? t('Earnings') : t('Wallet');

  if (isFundi) {
    return (
      <FundiEarningsScreen
        balance={wallet?.balance || 0}
        currency={wallet?.currency || 'UGX'}
        hidden={hidden}
        loading={loading}
        onCashOut={() => onNavigate?.('withdraw')}
      />
    );
  }

  const content = (
      <ScrollView
        contentContainerStyle={[
          isFundi ? styles.fundiScroll : styles.scroll,
          { paddingBottom: insets.bottom + 100 },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {!isFundi ? (
          <View style={styles.header}>
            <Text style={styles.title}>{pageTitle}</Text>
            <TouchableOpacity style={styles.historyBtn} onPress={() => onNavigate?.('transactionHistory')}>
              <Ionicons name="receipt-outline" size={20} color={theme.colors.accent} />
            </TouchableOpacity>
          </View>
        ) : null}

        {loading ? (
          <WalletSkeleton variant={isFundi ? 'fundi' : 'dark'} />
        ) : (
          <>
            <LinearGradient
              colors={isFundi ? [fc.card, fc.card] : ['#3A2A0F', '#1A1A1A']}
              style={[styles.balanceCard, isFundi && styles.fundiBalanceCard]}
            >
              <View style={styles.balanceTop}>
                <View style={styles.walletIconWrap}>
                  <Ionicons name="wallet" size={18} color={theme.colors.accent} />
                </View>
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setHidden((h) => !h)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={hidden ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={theme.colors.accent}
                  />
                </TouchableOpacity>
              </View>
              <Text style={[styles.balanceLabel, isFundi && styles.fundiBalanceLabel]}>
                {t('Available Balance')}
              </Text>
              <Text style={[styles.balanceAmount, isFundi && styles.fundiBalanceAmount]}>
                {maskAmount(wallet?.balance)}
              </Text>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        wallet?.status === 'active'
                          ? theme.colors.green
                          : theme.colors.red,
                    },
                  ]}
                />
                <Text style={[styles.statusText, isFundi && styles.fundiStatusText]}>
                  {wallet?.status === 'active' ? t('Active') : t('Frozen')}
                </Text>
              </View>
            </LinearGradient>

            <View style={styles.actionsRow}>
              {quickActions.map((a) => (
                <TouchableOpacity
                  key={a.key}
                  style={[styles.actionBtn, isFundi && styles.fundiActionBtn]}
                  onPress={() => {
                    if (a.key === 'history') return onNavigate?.('transactionHistory');
                    return onNavigate?.(a.key);
                  }}
                >
                  <View style={[styles.actionIcon, { backgroundColor: a.color + '20' }]}>
                    <Ionicons name={a.icon} size={22} color={a.color} />
                  </View>
                  <Text style={[styles.actionLabel, isFundi && styles.fundiActionLabel]}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isFundi && styles.fundiSectionTitle]}>
                {t('Recent Transactions')}
              </Text>
              <TouchableOpacity onPress={() => onNavigate?.('transactionHistory')}>
                <Text style={styles.viewAll}>{t('View All')}</Text>
              </TouchableOpacity>
            </View>

            {recentTx.length === 0 ? (
              <View style={styles.emptyWrap}>
                <EmptyState
                  icon="receipt-outline"
                  variant={isFundi ? 'fundi' : 'dark'}
                  title={t('No transactions yet')}
                  message={t('Your deposits, transfers and payments will appear here.')}
                />
                <PrimaryButton
                  onPress={() => onNavigate?.('deposit')}
                  icon="add-circle-outline"
                  style={styles.emptyBtn}
                >
                  {t('Make a Deposit')}
                </PrimaryButton>
              </View>
            ) : (
              recentTx.map((tx) => (
                <View key={tx._id} style={[styles.txRow, isFundi && styles.fundiTxRow]}>
                  <View style={[styles.txIcon, { backgroundColor: txColor(tx.type) + '20' }]}>
                    <Ionicons name={txIcon(tx.type)} size={18} color={txColor(tx.type)} />
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={[styles.txDesc, isFundi && styles.fundiTxDesc]} numberOfLines={1}>
                      {tx.description}
                    </Text>
                    <Text style={[styles.txDate, isFundi && styles.fundiTxDate]}>
                      {formatDate(tx.createdAt)}
                    </Text>
                  </View>
                  <View style={styles.txAmount}>
                    <Text style={[styles.txValue, { color: txColor(tx.type) }]}>
                      {['deposit', 'payment_received', 'refund', 'transfer_in'].includes(tx.type) ? '+' : '-'}
                      {wallet?.currency || 'UGX'} {(tx.amount || 0).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
  );

  if (isFundi) {
    return (
      <FundiThemedScreen
        title={pageTitle}
        rightIcon="receipt-outline"
        onRightPress={() => onNavigate?.('transactionHistory')}
        scroll={false}
        contentStyle={{ paddingTop: 0, paddingHorizontal: 0 }}
      >
        {content}
      </FundiThemedScreen>
    );
  }

  return (
    <ScreenWrapper style={styles.safe} edges={['top', 'left', 'right']}>
      {content}
    </ScreenWrapper>
  );
}

function FundiEarningsScreen({ balance, currency, hidden, loading, onCashOut }) {
  const chart = [77, 52, 87, 45, 86, 70, 41];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'];
  const available = hidden ? '••••••' : `${currency} ${balance.toLocaleString()}`;

  return (
    <ScreenWrapper
      edges={['top', 'left', 'right']}
      style={styles.earningsSafe}
      statusStripColor="#000000"
    >
      <View style={styles.earningsPage}>
        <View style={styles.earningsHeader}>
          <Text style={styles.earningsTitle}>Earnings</Text>
          <Text style={styles.weeklyTotal}>This week: <Text style={styles.weeklyAmount}>{currency} 19,200</Text></Text>
        </View>

        <View style={styles.chartCard}>
          <View style={styles.chartBars}>
            {chart.map((height, index) => (
              <View key={days[index]} style={styles.chartColumn}>
                <View style={styles.barTrack}>
                  <View style={[styles.bar, { height: `${height}%` }, index === chart.length - 1 && styles.todayBar]} />
                </View>
                <Text style={[styles.dayLabel, index === chart.length - 1 && styles.todayLabel]}>{days[index]}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.cashoutCard}>
          <View style={styles.cashoutIcon}>
            <Ionicons name="wallet-outline" size={19} color="#E5A600" />
          </View>
          <View style={styles.cashoutText}>
            <Text style={styles.cashoutLabel}>Available to withdraw</Text>
            <Text style={styles.cashoutAmount}>{loading ? 'Loading…' : available}</Text>
          </View>
          <TouchableOpacity style={styles.cashoutButton} onPress={onCashOut} activeOpacity={0.85}>
            <Text style={styles.cashoutButtonText}>Cash out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.comingSoon}>
          <View style={styles.comingSoonIcon}>
            <Ionicons name="sparkles-outline" size={19} color="#E5A600" />
          </View>
          <View style={styles.comingSoonCopy}>
            <Text style={styles.comingSoonTitle}>Coming soon</Text>
            <Text style={styles.comingSoonText}>Detailed earnings insights and weekly reports.</Text>
          </View>
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  earningsSafe: { backgroundColor: '#000000' },
  earningsPage: { flex: 1, backgroundColor: '#F7F7FA', paddingHorizontal: 20 },
  earningsHeader: { paddingTop: 18, paddingBottom: 12 },
  earningsTitle: { color: '#20253B', fontSize: 18, fontWeight: '800' },
  weeklyTotal: { color: '#74798A', fontSize: 11, fontWeight: '500', marginTop: 4 },
  weeklyAmount: { color: '#E5A600', fontWeight: '800' },
  chartCard: {
    height: 132, backgroundColor: '#FFFFFF', borderRadius: 15, paddingHorizontal: 14, paddingTop: 13, marginBottom: 14,
    shadowColor: '#1D2350', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  chartBars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around' },
  chartColumn: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  barTrack: { height: 86, width: 13, justifyContent: 'flex-end' },
  bar: { width: 13, borderRadius: 4, backgroundColor: '#E9E9EE' },
  todayBar: { backgroundColor: '#FFB800' },
  dayLabel: { color: '#73798A', fontSize: 9, marginTop: 7 },
  todayLabel: { color: '#20253B', fontWeight: '800' },
  cashoutCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 15, minHeight: 56, paddingHorizontal: 12, marginBottom: 14,
    shadowColor: '#1D2350', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  cashoutIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFF4D1', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  cashoutText: { flex: 1 },
  cashoutLabel: { color: '#777D90', fontSize: 10 },
  cashoutAmount: { color: '#C18B00', fontSize: 14, fontWeight: '800', marginTop: 2 },
  cashoutButton: { backgroundColor: '#FFB800', borderRadius: 18, paddingHorizontal: 13, height: 29, alignItems: 'center', justifyContent: 'center' },
  cashoutButtonText: { color: '#0B0B0B', fontSize: 10, fontWeight: '800' },
  comingSoon: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF8E7', borderRadius: 15, padding: 15, borderWidth: 1, borderColor: '#F6DF9E' },
  comingSoonIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  comingSoonCopy: { flex: 1 },
  comingSoonTitle: { color: '#0B0B0B', fontSize: 13, fontWeight: '800' },
  comingSoonText: { color: '#74798A', fontSize: 11, marginTop: 3, lineHeight: 15 },
  safe: { flex: 1, backgroundColor: theme.colors.black },
  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { color: theme.colors.white, fontSize: 20, fontWeight: '900' },
  historyBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' },
  balanceCard: {
    borderRadius: 22,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.elevation.md,
  },
  balanceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  walletIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,184,0,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,184,0,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceLabel: { color: theme.colors.muted, fontSize: 13, fontWeight: '700' },
  balanceAmount: { color: theme.colors.accent, fontSize: 36, fontWeight: '900', marginTop: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: theme.colors.muted, fontSize: 12, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  actionBtn: { flex: 1, alignItems: 'center', backgroundColor: theme.colors.panel, borderRadius: 16, paddingVertical: 14, borderWidth: 1, borderColor: theme.colors.border },
  actionIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  actionLabel: { color: theme.colors.white, fontSize: 11, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: theme.colors.white, fontSize: 16, fontWeight: '800' },
  viewAll: { color: theme.colors.accent, fontSize: 13, fontWeight: '700' },
  emptyWrap: {
    alignItems: 'center',
    backgroundColor: theme.colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
  },
  emptyBtn: { marginBottom: 16 },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.panel,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  txIcon: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txInfo: { flex: 1 },
  txDesc: { color: theme.colors.white, fontWeight: '600', fontSize: 13 },
  txDate: { color: theme.colors.mutedDark, fontSize: 11, marginTop: 2 },
  txAmount: {},
  txValue: { fontWeight: '800', fontSize: 13 },
  fundiScroll: { paddingHorizontal: 16, paddingTop: 8 },
  fundiBalanceCard: {
    borderColor: fc.border,
    ...fundiCardShadow,
  },
  fundiBalanceLabel: { color: fc.textMuted },
  fundiBalanceAmount: { color: fc.accentDark },
  fundiStatusText: { color: fc.textMuted },
  fundiActionBtn: {
    backgroundColor: fc.card,
    borderColor: fc.border,
    ...fundiCardShadow,
  },
  fundiActionLabel: { color: fc.text },
  fundiSectionTitle: { color: fc.text },
  fundiTxRow: {
    backgroundColor: fc.card,
    borderColor: fc.border,
    ...fundiCardShadow,
  },
  fundiTxDesc: { color: fc.text },
  fundiTxDate: { color: fc.textMuted },
});
