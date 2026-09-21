import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { fc as fundiAccent, fundiStyles } from '../fundiTheme';
import ScreenWrapper from '../components/ScreenWrapper';
import FundiThemedScreen from '../components/FundiThemedScreen';
import EmptyState from '../components/EmptyState';
import { useNotifications } from '../../context/NotificationContext';
import { useLanguage } from '../i18n/LanguageContext';

function timeLabel(iso) {
  if (!iso) return 'Now';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const date = new Date(iso);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

function iconFor(type) {
  switch (type) {
    case 'message':
      return 'chatbubble-ellipses-outline';
    case 'system':
      return 'shield-checkmark-outline';
    default:
      return 'construct-outline';
  }
}

export default function NotificationsScreen({ onNavigate, userRole = 'customer' }) {
  const isFundi = userRole === 'fundi';
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('all');
  const { notifications, loading, refresh, markRead, markAllRead } = useNotifications();

  useEffect(() => {
    refresh();
  }, [refresh]);

  const chips = [
    { key: 'all', label: t('All') },
    { key: 'booking', label: t('Bookings'), match: 'booking' },
    { key: 'message', label: t('Messages'), match: 'message' },
    { key: 'system', label: t('Updates'), match: 'system' },
  ];

  const filtered = useMemo(
    () =>
      activeTab === 'all'
        ? notifications
        : notifications.filter((n) => n.type === activeTab),
    [notifications, activeTab]
  );

  const openNotification = useCallback(
    (item) => {
      if (item && !item.read) markRead(item.id);
      const data = item?.data || {};
      if (data.event === 'new_message' && data.senderId) {
        onNavigate?.('chat', { targetUserId: data.senderId });
        return;
      }
      if (data.bookingId) {
        if (isFundi) {
          onNavigate?.('fundiBookingDetail', { bookingId: data.bookingId });
        } else {
          onNavigate?.('bookings');
        }
      }
    },
    [markRead, onNavigate, isFundi]
  );

  const renderItem = ({ item }) => {
    const unread = !item.read;
    return (
      <TouchableOpacity
        style={[styles.card, isFundi && styles.cardFundi, unread && styles.cardUnread]}
        activeOpacity={0.8}
        onPress={() => openNotification(item)}
      >
        <View style={[styles.iconDot, isFundi && styles.iconDotFundi]}>
          <Ionicons
            name={iconFor(item.type)}
            size={18}
            color={isFundi ? fundiAccent.accent : theme.colors.accent}
          />
          {unread ? <View style={styles.unreadDot} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, isFundi && styles.cardTitleFundi]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text
            style={[styles.cardBody, isFundi && styles.cardBodyFundi, unread && { fontWeight: '700' }]}
            numberOfLines={2}
          >
            {typeof item.body === 'object' ? JSON.stringify(item.body) : item.body}
          </Text>
        </View>
        <Text style={[styles.time, isFundi && styles.timeFundi]}>{timeLabel(item.createdAt || item.created_at)}</Text>
      </TouchableOpacity>
    );
  };

  const listBody = (
    <>
      <View style={isFundi ? fundiStyles.tabRow : styles.chipsRow}>
        {chips.map((c) => {
          const isActive = c.key === activeTab;
          return (
            <TouchableOpacity
              key={c.key}
              style={[
                isFundi ? fundiStyles.tab : styles.chip,
                isActive && (isFundi ? fundiStyles.tabActive : styles.chipActive),
              ]}
              onPress={() => setActiveTab(c.key)}
            >
              <Text
                style={[
                  isFundi ? fundiStyles.tabText : styles.chipText,
                  isActive && (isFundi ? fundiStyles.tabTextActive : styles.chipTextActive),
                ]}
              >
                {c.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.colors.accent} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="notifications-outline"
            variant={isFundi ? 'fundi' : 'dark'}
            title={t('No notifications yet')}
            message={t('Booking updates and messages will appear here.')}
          />
        }
        renderItem={renderItem}
      />

      {notifications.length > 0 && (
        <TouchableOpacity style={styles.markAllRow} onPress={markAllRead} activeOpacity={0.7}>
          <Ionicons
            name="checkmark-done-outline"
            size={14}
            color={isFundi ? fundiAccent.accent : theme.colors.accent}
          />
          <Text
            style={[
              styles.markAllText,
              isFundi && { color: fundiAccent.accent },
            ]}
          >
            {t('Mark all read')}
          </Text>
        </TouchableOpacity>
      )}
    </>
  );

  if (isFundi) {
    return (
      <FundiThemedScreen
        title={t('Notifications')}
        onBack={() => onNavigate?.('home')}
        scroll={false}
        contentStyle={{ paddingTop: 8, flex: 1 }}
      >
        <View style={{ flex: 1 }}>{listBody}</View>
      </FundiThemedScreen>
    );
  }

  return (
    <ScreenWrapper style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => onNavigate?.('profile')} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={20} color={theme.colors.accent} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('Notifications')}</Text>
          <View style={{ width: 40 }} />
        </View>
        {listBody}
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bgDark },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.input, borderWidth: 1, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' },
  title: { color: theme.colors.white, fontSize: 18, fontWeight: '900' },
  chipsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.pill, backgroundColor: theme.colors.input },
  chipActive: { backgroundColor: theme.colors.accent },
  chipText: { color: theme.colors.mutedDark, fontWeight: '700', fontSize: 11 },
  chipTextActive: { color: theme.colors.textDark, fontWeight: '900' },
  card: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: theme.colors.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
  },
  cardUnread: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentDim },
  iconDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,184,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  iconDotFundi: { backgroundColor: 'rgba(38,194,129,0.15)' },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: theme.colors.accent,
    borderWidth: 1.5,
    borderColor: theme.colors.panel,
  },
  cardTitle: { color: theme.colors.white, fontWeight: '900' },
  cardTitleFundi: { color: '#111' },
  cardBody: { color: theme.colors.muted, fontSize: 12, marginTop: 4 },
  cardBodyFundi: { color: '#555' },
  time: { color: theme.colors.mutedDark, fontSize: 10, marginLeft: 8 },
  timeFundi: { color: '#777' },
  markAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  markAllText: { color: theme.colors.accent, fontSize: 12, fontWeight: '800' },
});