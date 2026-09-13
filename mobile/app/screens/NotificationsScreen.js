import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { fc, fundiCardShadow, fundiStyles } from '../fundiTheme';
import ScreenWrapper from '../components/ScreenWrapper';
import FundiThemedScreen from '../components/FundiThemedScreen';
import EmptyState from '../components/EmptyState';
import { useBookingOptional } from '../../context/BookingContext';
import { useLanguage } from '../i18n/LanguageContext';

export default function NotificationsScreen({ onNavigate, userRole = 'customer' }) {
  const isFundi = userRole === 'fundi';
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('all');
  const bookingCtx = useBookingOptional();

  const notifications = useMemo(() => {
    const list = [];
    if (bookingCtx?.notification) {
      list.push({
        id: 'live',
        type: 'booking',
        title: bookingCtx.notification.title,
        body: bookingCtx.notification.message,
        time: 'Now',
      });
    }
    return list;
  }, [bookingCtx?.notification]);

  const chips = [
    { key: 'all', label: t('All') },
    { key: 'bookings', label: t('Bookings') },
    { key: 'messages', label: t('Messages') },
    { key: 'updates', label: t('Updates') },
  ];

  const filtered = notifications.filter(
    (n) => activeTab === 'all' || n.type === activeTab.replace(/s$/, '')
  );

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
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              variant={isFundi ? 'fundi' : 'dark'}
              title={t('No notifications yet')}
              message={t('Booking updates and messages will appear here.')}
            />
          }
          renderItem={({ item }) => (
            <View style={[styles.card, isFundi && styles.cardFundi]}>
              <View style={styles.iconDot}>
                <Text style={styles.iconText}>!</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, isFundi && styles.cardTitleFundi]}>{item.title}</Text>
                <Text style={[styles.cardBody, isFundi && styles.cardBodyFundi]}>{item.body}</Text>
              </View>
              <Text style={[styles.time, isFundi && styles.timeFundi]}>{t(item.time)}</Text>
            </View>
          )}
        />
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
  backText: { color: theme.colors.accent, fontWeight: '800' },
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
  iconDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,184,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: { color: theme.colors.accent, fontWeight: '900' },
  cardTitle: { color: theme.colors.white, fontWeight: '900' },
  cardBody: { color: theme.colors.muted, fontSize: 12, marginTop: 4 },
  time: { color: theme.colors.mutedDark, fontSize: 10, marginLeft: 8 },
});
