import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { fc, fundiCardShadow } from '../fundiTheme';
import ScreenWrapper from '../components/ScreenWrapper';
import FundiThemedScreen from '../components/FundiThemedScreen';
import EmptyState from '../components/EmptyState';
import { getTransactions } from '../../services/walletApi';
import { useLanguage } from '../i18n/LanguageContext';

const TX_TABS = [
  { key: 'all', label: 'All' },
  { key: 'deposit', label: 'Deposits' },
  { key: 'withdrawal', label: 'Withdrawals' },
  { key: 'payment', label: 'Payments' },
];

export default function TransactionHistoryScreen({ onNavigate, userRole = 'customer' }) {
  const isFundi = userRole === 'fundi';
  const { t } = useLanguage();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async (pageNum = 1, append = false) => {
    try {
      const params = { page: pageNum, limit: 20 };
      if (tab !== 'all') params.type = tab;
      const { data } = await getTransactions(params);
      if (append) {
        setTransactions((prev) => [...prev, ...(data.transactions || [])]);
      } else {
        setTransactions(data.transactions || []);
      }
      setTotalPages(data.totalPages || 1);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    load(1);
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    load(1);
  };

  const loadMore = () => {
    if (page < totalPages && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      load(nextPage, true);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return d.toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' });
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
    if (type === 'payment') return theme.colors.accent;
    return theme.colors.red;
  };

  const txLabel = (type) => {
    const labels = {
      deposit: 'Deposit',
      withdrawal: 'Withdrawal',
      payment: 'Payment',
      payment_received: 'Payment Received',
      refund: 'Refund',
      transfer_out: 'Transfer Sent',
      transfer_in: 'Transfer Received',
    };
    return labels[type] || type;
  };

  const isCredit = (type) => ['deposit', 'payment_received', 'refund', 'transfer_in'].includes(type);

  const content = (
    <View style={[styles.container, isFundi && styles.containerFundi]}>
      {!isFundi ? (
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => onNavigate?.('wallet')}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.white} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('Transaction History')}</Text>
          <View style={{ width: 40 }} />
        </View>
      ) : null}

      <View style={styles.tabRow}>
        {TX_TABS.map((tabItem) => (
          <TouchableOpacity
            key={tabItem.key}
            style={[styles.tab, isFundi && styles.fundiTab, tab === tabItem.key && styles.tabOn, tab === tabItem.key && isFundi && styles.fundiTabOn]}
            onPress={() => setTab(tabItem.key)}
          >
            <Text style={[styles.tabText, isFundi && styles.fundiTabText, tab === tabItem.key && styles.tabTextOn]}>{t(tabItem.label)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />}
        onMomentumScrollEnd={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 40) {
            loadMore();
          }
        }}
      >
        {loading && transactions.length === 0 ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={theme.colors.accent} size="large" />
          </View>
        ) : transactions.length === 0 ? (
          <View style={styles.emptyTx}>
            <EmptyState
              variant={isFundi ? 'fundi' : 'dark'}
              icon="receipt-outline"
              title={t('No transactions found')}
            />
          </View>
        ) : (
          transactions.map((tx) => (
            <View key={tx._id} style={[styles.txRow, isFundi && styles.fundiTxRow]}>
              <View style={[styles.txIcon, { backgroundColor: txColor(tx.type) + '20' }]}>
                <Ionicons name={txIcon(tx.type)} size={20} color={txColor(tx.type)} />
              </View>
              <View style={styles.txInfo}>
                <Text style={[styles.txType, isFundi && styles.fundiText]}>{t(txLabel(tx.type))}</Text>
                <Text style={[styles.txDesc, isFundi && styles.fundiTextMuted]} numberOfLines={1}>{tx.description}</Text>
                <Text style={[styles.txDate, isFundi && styles.fundiTextSubtle]}>{t(formatDate(tx.createdAt))}{tx.reference ? ` · ${tx.reference}` : ''}</Text>
              </View>
              <View style={styles.txAmount}>
                <Text style={[styles.txValue, { color: txColor(tx.type) }]}>
                  {isCredit(tx.type) ? '+' : '-'}UGX {(tx.amount || 0).toLocaleString()}
                </Text>
                <Text style={[styles.txBalance, isFundi && styles.fundiTextSubtle]}>{t('Bal: UGX {{amount}}', { amount: (tx.balanceAfter || 0).toLocaleString() })}</Text>
              </View>
            </View>
          ))
        )}
        {page < totalPages && transactions.length > 0 && (
          <View style={styles.loadMore}>
            <ActivityIndicator color={theme.colors.accent} size="small" />
          </View>
        )}
      </ScrollView>
    </View>
  );

  if (isFundi) {
    return (
      <FundiThemedScreen
        title={t('Transaction History')}
        onBack={() => onNavigate?.('wallet')}
        scroll={false}
        contentStyle={{ paddingTop: 8, flex: 1 }}
      >
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
  container: { flex: 1, paddingTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.input, borderWidth: 1, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' },
  title: { color: theme.colors.white, fontSize: 18, fontWeight: '800' },
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 16 },
  tab: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: theme.radius.pill, backgroundColor: theme.colors.input, borderWidth: 1, borderColor: theme.colors.border },
  tabOn: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  tabText: { color: theme.colors.muted, fontWeight: '700', fontSize: 12 },
  tabTextOn: { color: theme.colors.textDark },
  loadingWrap: { paddingVertical: 60, alignItems: 'center' },
  emptyTx: { alignItems: 'center', paddingVertical: 60 },
  emptyTxText: { color: theme.colors.mutedDark, fontSize: 15, marginTop: 12 },
  txRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  txIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txInfo: { flex: 1 },
  txType: { color: theme.colors.white, fontWeight: '800', fontSize: 14 },
  txDesc: { color: theme.colors.muted, fontSize: 12, marginTop: 1 },
  txDate: { color: theme.colors.mutedDark, fontSize: 11, marginTop: 2 },
  txAmount: { alignItems: 'flex-end' },
  txValue: { fontWeight: '900', fontSize: 14 },
  txBalance: { color: theme.colors.mutedDark, fontSize: 10, marginTop: 2 },
  loadMore: { paddingVertical: 20, alignItems: 'center' },

  containerFundi: { backgroundColor: fc.page },
  fundiText: { color: fc.text },
  fundiTextMuted: { color: fc.textMuted },
  fundiTextSubtle: { color: fc.textSubtle },
  fundiTab: { backgroundColor: fc.card, borderColor: fc.border },
  fundiTabOn: { backgroundColor: fc.accent, borderColor: fc.accent },
  fundiTabText: { color: fc.textMuted },
  fundiTxRow: {
    backgroundColor: fc.card,
    borderBottomColor: fc.border,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    borderBottomWidth: 0,
    borderWidth: 1,
    paddingHorizontal: 12,
    ...fundiCardShadow,
  },
});
