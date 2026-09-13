import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../components/ScreenWrapper';
import { useBooking } from '../../context/BookingContext';
import { useLocation } from '../../context/LocationContext';
import {
  updateFundiAvailability,
  updateBookingStatus,
  acceptBooking,
  declineBooking,
  getErrorMessage,
} from '../../services/bookingsApi';
import { getProfile } from '../../services/usersApi';
import { emitSocket } from '../../services/socketService';
import { computeEarnings, getGreeting } from '../utils/jobs';
import { BOOKING_STATUS_LABELS } from '../utils/bookings';
import { formatUgx, initials } from '../utils/ratings';
import theme from '../theme';
import { useLanguage } from '../i18n/LanguageContext';

function toClockLabel(date, offsetMinutes = 0) {
  if (!date) return '';
  const d = new Date(date);
  if (offsetMinutes) d.setMinutes(d.getMinutes() + offsetMinutes);
  return d.toLocaleTimeString('en-UG', { hour: 'numeric', minute: '2-digit' });
}

function compactK(amount) {
  const value = Math.max(0, Number(amount) || 0);
  if (value < 1000) return `${value}`;
  return `${Math.round(value / 1000)}k`;
}

const ACTIVE_STATUS_TINT = {
  ACCEPTED: { bg: 'rgba(59,130,246,0.12)', fg: '#3B82F6' },
  ON_THE_WAY: { bg: 'rgba(255,184,0,0.14)', fg: theme.colors.accentDark },
  ARRIVED: { bg: 'rgba(167,139,250,0.14)', fg: '#8B5CF6' },
  IN_PROGRESS: { bg: 'rgba(34,197,94,0.12)', fg: theme.colors.green },
};

const JOB_FLOW = ['ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'];

const NEXT_JOB_ACTION = {
  ACCEPTED: { status: 'ON_THE_WAY', cta: 'Mark On the Way' },
  ON_THE_WAY: { status: 'ARRIVED', cta: 'Mark Arrived' },
  ARRIVED: { status: 'IN_PROGRESS', cta: 'Start Work' },
  IN_PROGRESS: { status: 'COMPLETED', cta: 'Mark Complete' },
};

function MiniStat({ label, value, highlight }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatLabel}>{label}</Text>
      <Text style={[styles.miniStatValue, highlight && styles.miniStatValueAccent]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function SectionHeading({ title, actionLabel, onAction }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel ? (
        <TouchableOpacity style={styles.sectionActionBtn} onPress={onAction} activeOpacity={0.75}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
          <Ionicons name="arrow-forward" size={12} color={theme.colors.accent} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function FundiDashboardScreen({
  onNavigate,
  userName,
  userFullName,
  fundiEnabled,
  onSwitchToClientMode,
}) {
  const { t } = useLanguage();
  const { address } = useLocation();
  const {
    bookings,
    refreshBookings,
    loading: bookingsLoading,
    pendingRequest,
    setPendingRequest,
  } = useBooking();
  const [availabilityMode, setAvailabilityMode] = useState('online');
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [acceptLoading, setAcceptLoading] = useState(false);
  const [declineLoading, setDeclineLoading] = useState(false);
  const [fundiRating, setFundiRating] = useState(null);
  const [locationLabel, setLocationLabel] = useState('');

  const isOnline = availabilityMode === 'online';
  const displayName = userFullName || userName || '';
  const firstName = displayName.split(' ')[0] || displayName;

  useEffect(() => {
    refreshBookings();
  }, [refreshBookings]);

  const activeBookings = useMemo(
    () =>
      bookings.filter(
        (b) =>
          ['ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'].includes(b.status) &&
          !(b.clientCompleted && b.fundiCompleted),
      ),
    [bookings],
  );

  const completedBookings = useMemo(
    () => bookings.filter((b) => b.status === 'COMPLETED'),
    [bookings],
  );

  const earnings = useMemo(
    () =>
      computeEarnings(
        completedBookings.map((b) => ({
          status: 'completed',
          quoteAmount: b.amount || b.agreedPrice || 0,
          updatedAt: b.createdAt,
          createdAt: b.createdAt,
        })),
      ),
    [completedBookings],
  );

  const jobsDoneToday = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return completedBookings.filter((b) => {
      const raw = b.updatedAt || b.createdAt;
      return raw && new Date(raw) >= startOfDay;
    }).length;
  }, [completedBookings]);

  const active = activeBookings[0] || null;
  const request = pendingRequest || null;

  const activeCard = useMemo(() => {
    if (!active) return null;
    const agreed = active.agreedPrice || active.serviceFee || null;
    const status = JOB_FLOW.includes(active.status) ? active.status : 'ACCEPTED';
    return {
      id: active.id || active._id || active.bookingId || null,
      name: active.clientName || active.customerName || t('Client'),
      service: active.category || active.service || '',
      description: active.description || '',
      address: typeof active.address === 'string' ? active.address : '',
      startedAt: active.createdAt || null,
      status,
      priceAgreed: active.priceAgreed ?? Boolean(agreed),
      agreedPrice: agreed ? Number(agreed) : 0,
      clientCompleted: Boolean(active.clientCompleted),
      fundiCompleted: Boolean(active.fundiCompleted),
    };
  }, [active, t]);

  const jobStep = activeCard ? JOB_FLOW.indexOf(activeCard.status) : -1;
  const jobProgress = Math.round(((jobStep + 1) / JOB_FLOW.length) * 100);
  const nextJobAction = activeCard ? NEXT_JOB_ACTION[activeCard.status] : null;
  const awaitingClientConfirm = Boolean(
    activeCard &&
      activeCard.status === 'IN_PROGRESS' &&
      activeCard.fundiCompleted &&
      !activeCard.clientCompleted,
  );
  const canAdvanceJob = Boolean(
    activeCard && !awaitingClientConfirm && (activeCard.priceAgreed || jobStep > 0),
  );

  useEffect(() => {
    if (activeBookings.length === 0) return undefined;
    const id = setInterval(() => refreshBookings(), 8000);
    return () => clearInterval(id);
  }, [activeBookings.length, refreshBookings]);

  const requestCard = useMemo(() => {
    if (!request) return null;
    return {
      id: request.bookingId || request.id || request._id || null,
      name: request.clientName || t('Client'),
      summary: request.description || request.service || request.category || '',
      address: request.address || '',
      price: Number(request.estimatedPrice || request.amount) || 0,
      distanceKm: request.distanceKm || null,
    };
  }, [request, t]);

  useEffect(() => {
    let cancelled = false;
    getProfile()
      .then(({ data }) => {
        if (cancelled) return;
        setFundiRating(Number(data?.fundiProfile?.rating) || 0);
        setLocationLabel(data?.user?.locationLabel || data?.user?.address || '');
        const isAvailable = data?.fundiProfile?.isAvailable != null
          ? Boolean(data.fundiProfile.isAvailable)
          : true;
        setAvailabilityMode(!isAvailable ? 'offline' : 'online');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const avgRating = fundiRating;
  const resolvedLocation = address || locationLabel || t('Set your location');

  const handleSetAvailability = async (mode) => {
    const prev = availabilityMode;
    setAvailabilityMode(mode);
    setAvailabilityLoading(true);
    try {
      await updateFundiAvailability(mode === 'online', false);
    } catch (e) {
      setAvailabilityMode(prev);
      Alert.alert(t('Could not update availability'), getErrorMessage(e));
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const handleAdvanceJob = async () => {
    if (!activeCard || !nextJobAction || !canAdvanceJob) return;
    setStatusUpdating(true);
    try {
      const res = await updateBookingStatus(activeCard.id, nextJobAction.status);
      if (nextJobAction.status === 'ON_THE_WAY') {
        onNavigate?.('fundiNavigation', { bookingId: activeCard.id });
      }
      await refreshBookings();
      if (nextJobAction.status === 'COMPLETED' && res?.data?.booking?.status !== 'COMPLETED') {
        Alert.alert(
          t('Waiting for client'),
          t('You confirmed the job. Payment is released as soon as the client confirms too.'),
        );
      }
    } catch (e) {
      Alert.alert(t('Could not update job'), getErrorMessage(e));
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleOpenNavigation = () => {
    if (!activeCard?.id) return;
    onNavigate?.('fundiNavigation', { bookingId: activeCard.id });
  };

  const handleAcceptRequest = async () => {
    const id = requestCard?.id;
    if (!id) return;
    setAcceptLoading(true);
    try {
      await acceptBooking(id);
      emitSocket('accept_booking', { bookingId: id });
      setPendingRequest(null);
      Alert.alert(t('Booking accepted'), t("{{name}}'s request has been accepted.", { name: requestCard.name }));
      await refreshBookings();
      onNavigate?.('fundiBookingDetail', { bookingId: id });
    } catch (e) {
      Alert.alert(t('Could not accept'), getErrorMessage(e));
    } finally {
      setAcceptLoading(false);
    }
  };

  const handleDeclineRequest = async () => {
    const id = requestCard?.id;
    if (!id) return;
    setDeclineLoading(true);
    try {
      await declineBooking(id);
      emitSocket('decline_booking', { bookingId: id });
      setPendingRequest(null);
      await refreshBookings();
    } catch (e) {
      Alert.alert(t('Could not decline'), getErrorMessage(e));
    } finally {
      setDeclineLoading(false);
    }
  };

  const showOfflineEmpty = !isOnline && !activeCard && !requestCard;

  return (
    <ScreenWrapper style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.locationRow}
          activeOpacity={0.85}
          onPress={() => onNavigate?.('setLocation')}
        >
          <Ionicons name="location" size={14} color={theme.colors.accent} />
          <Text style={styles.locationText} numberOfLines={1}>
            {resolvedLocation}
          </Text>
        </TouchableOpacity>

        <View style={styles.headerMain}>
          <Text style={styles.greetingLine}>
            {t(getGreeting())}, {firstName}
          </Text>
          <TouchableOpacity
            style={styles.bellButton}
            activeOpacity={0.85}
            onPress={() => onNavigate?.('notifications')}
          >
            <Ionicons name="notifications-outline" size={20} color={theme.colors.white} />
          </TouchableOpacity>
        </View>

        {fundiEnabled && onSwitchToClientMode ? (
          <TouchableOpacity
            style={styles.clientModeBanner}
            onPress={onSwitchToClientMode}
            activeOpacity={0.85}
          >
            <Ionicons name="person-outline" size={18} color={theme.colors.accent} />
            <View style={styles.clientModeText}>
              <Text style={styles.clientModeTitle}>{t('Client Mode')}</Text>
              <Text style={styles.clientModeSub}>
                {t('Switch back to browsing and booking jobs as a client')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
        ) : null}

        <View style={styles.statusCard}>
          <View style={styles.statusLeft}>
            <View style={styles.statusTitleRow}>
              <View style={[styles.statusDot, isOnline && styles.statusDotOnline]} />
              <Text style={styles.statusTitle}>
                {isOnline ? t("You're online") : t("You're offline")}
              </Text>
            </View>
            <Text style={styles.statusSub}>
              {isOnline
                ? t('Nearby clients can see you and send booking requests')
                : t('Go online to start receiving requests.')}
            </Text>
          </View>
          <Switch
            value={isOnline}
            onValueChange={(value) => handleSetAvailability(value ? 'online' : 'offline')}
            trackColor={{ false: '#E5E7EB', true: theme.colors.accent }}
            thumbColor={theme.colors.white}
            ios_backgroundColor="#E5E7EB"
            disabled={availabilityLoading}
          />
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsRow}>
          <MiniStat
            label={t('Earnings today')}
            value={formatUgx(earnings.today)}
            highlight
          />
          <MiniStat label={t('Jobs done')} value={`${jobsDoneToday}`} />
          <MiniStat
            label={t('Rating')}
            value={avgRating ? `${avgRating.toFixed(1)} ★` : '—'}
          />
        </View>

        {showOfflineEmpty ? (
          <View style={styles.mainCard}>
            <View style={styles.mainCardIconWrap}>
              <Ionicons name="briefcase-outline" size={28} color={theme.colors.textSubtle} />
            </View>
            <Text style={styles.mainCardTitle}>{t("You're currently offline")}</Text>
            <Text style={styles.mainCardMessage}>
              {t('Flip the switch above whenever you\'re ready to work.')}
            </Text>
          </View>
        ) : (
          <>
            {isOnline && !activeCard && !requestCard ? (
              <View style={styles.mainCard}>
                <View style={styles.mainCardIconWrap}>
                  <Ionicons name="radio-outline" size={28} color={theme.colors.accent} />
                </View>
                <Text style={styles.mainCardTitle}>{t("You're online")}</Text>
                <Text style={styles.mainCardMessage}>
                  {t('Keep yourself online to receive booking requests from clients.')}
                </Text>
              </View>
            ) : null}

            {requestCard ? (
              <View style={styles.sectionBlock}>
                <SectionHeading title={t('New Requests')} />
                <View style={styles.requestCard}>
                  <View style={styles.requestBadgeRow}>
                    <View style={styles.requestUrgentBadge}>
                      <Text style={styles.requestUrgentText}>{t('NEW')}</Text>
                    </View>
                    <View style={styles.requestPriceRow}>
                      {requestCard.distanceKm ? (
                        <View style={styles.requestDistance}>
                          <Ionicons name="location-outline" size={11} color={theme.colors.textMuted} />
                          <Text style={styles.requestDistanceText}>
                            {Number(requestCard.distanceKm).toFixed(1)} km
                          </Text>
                        </View>
                      ) : null}
                      <Text style={styles.requestPrice}>
                        {requestCard.price ? compactK(requestCard.price) : t('Quote pending')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.requestProfileRow}>
                    <View style={styles.requestAvatar}>
                      <Text style={styles.requestAvatarText}>{initials(requestCard.name)}</Text>
                    </View>
                    <View style={styles.requestMeta}>
                      <Text style={styles.requestName} numberOfLines={1}>{requestCard.name}</Text>
                      <Text style={styles.requestSummary} numberOfLines={2}>{requestCard.summary}</Text>
                      {requestCard.address ? (
                        <Text style={styles.requestAddress} numberOfLines={1}>📍 {requestCard.address}</Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={[styles.declineButton, declineLoading && styles.actionDisabled]}
                      activeOpacity={0.85}
                      onPress={handleDeclineRequest}
                      disabled={declineLoading || acceptLoading}
                    >
                      {declineLoading ? (
                        <ActivityIndicator size="small" color={theme.colors.textMuted} />
                      ) : (
                        <Text style={styles.declineButtonText}>{t('Decline')}</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.acceptButton, acceptLoading && styles.actionDisabled]}
                      activeOpacity={0.85}
                      onPress={handleAcceptRequest}
                      disabled={acceptLoading || declineLoading}
                    >
                      {acceptLoading ? (
                        <ActivityIndicator size="small" color={theme.colors.textDark} />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle-outline" size={17} color={theme.colors.textDark} />
                          <Text style={styles.acceptButtonText}>{t('Accept')}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : null}

            {activeCard ? (
              <View style={styles.sectionBlock}>
                <SectionHeading
                  title={t('Active Job')}
                  actionLabel={t('See all jobs')}
                  onAction={() => onNavigate?.('bookings')}
                />
                <View style={styles.activeCard}>
                  <View style={styles.activeTopRow}>
                    <View
                      style={[
                        styles.activeStatusPill,
                        {
                          backgroundColor: ACTIVE_STATUS_TINT[activeCard.status]?.bg,
                          borderColor: ACTIVE_STATUS_TINT[activeCard.status]?.fg,
                        },
                      ]}
                    >
                      <View
                        style={[styles.smallDot, { backgroundColor: ACTIVE_STATUS_TINT[activeCard.status]?.fg }]}
                      />
                      <Text style={[styles.activeStatusText, { color: ACTIVE_STATUS_TINT[activeCard.status]?.fg }]}>
                        {t(BOOKING_STATUS_LABELS[activeCard.status] || activeCard.status)}
                      </Text>
                    </View>
                    {activeCard.startedAt ? (
                      <Text style={styles.startedText}>
                        {t('Started {{time}}', { time: toClockLabel(activeCard.startedAt) })}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.activeProfileRow}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarText}>{initials(activeCard.name) || '?'}</Text>
                    </View>
                    <View style={styles.activeMeta}>
                      <Text style={styles.activeName} numberOfLines={1}>{activeCard.name}</Text>
                      <Text style={styles.activeService} numberOfLines={1}>
                        {activeCard.service ? `⚡ ${t(activeCard.service)}` : ''}
                      </Text>
                      {activeCard.address ? (
                        <Text style={styles.activeAddress} numberOfLines={1}>📍 {activeCard.address}</Text>
                      ) : null}
                    </View>
                    <View style={styles.priceChip}>
                      <Text style={styles.priceChipLabel}>{t('Price')}</Text>
                      <Text style={[styles.priceChipValue, !activeCard.agreedPrice && styles.priceChipPending]}>
                        {activeCard.agreedPrice ? formatUgx(activeCard.agreedPrice) : t('Not set')}
                      </Text>
                    </View>
                  </View>

                  {activeCard.description ? (
                    <Text style={styles.activeDescription} numberOfLines={2}>
                      {activeCard.description}
                    </Text>
                  ) : null}

                  <View style={styles.stepTrack}>
                    {JOB_FLOW.map((step, i) => (
                      <View
                        key={step}
                        style={[styles.stepSeg, i <= jobStep && styles.stepSegDone, i === jobStep && styles.stepSegCurrent]}
                      />
                    ))}
                  </View>
                  <View style={styles.progressRow}>
                    <Text style={styles.progressText}>
                      {t('{{percent}}% · step {{step}} of {{total}}', {
                        percent: jobProgress,
                        step: jobStep + 1,
                        total: JOB_FLOW.length,
                      })}
                    </Text>
                  </View>

                  {awaitingClientConfirm ? (
                    <Text style={styles.awaitingText}>
                      {t('Waiting for client to release payment')}
                    </Text>
                  ) : !canAdvanceJob ? (
                    <Text style={styles.finishText}>{t('Waiting for price agreement')}</Text>
                  ) : null}

                  <TouchableOpacity
                    style={[styles.primaryAction, (!canAdvanceJob || statusUpdating) && styles.actionDisabled]}
                    disabled={!canAdvanceJob || statusUpdating}
                    onPress={handleAdvanceJob}
                  >
                    {statusUpdating ? (
                      <ActivityIndicator size="small" color={theme.colors.textDark} />
                    ) : (
                      <Text style={styles.primaryActionText}>
                        ✓ {t(awaitingClientConfirm ? 'Awaiting client confirmation' : nextJobAction?.cta || 'Manage Job')}
                      </Text>
                    )}
                  </TouchableOpacity>

                  <View style={styles.secondaryRow}>
                    <TouchableOpacity style={styles.secondaryAction} activeOpacity={0.88} onPress={() => onNavigate?.('chat')}>
                      <Ionicons name="chatbubble-outline" size={16} color={theme.colors.blue} />
                      <Text style={styles.secondaryActionText}>{t('Chat')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryAction} activeOpacity={0.88} onPress={handleOpenNavigation}>
                      <Ionicons name="navigate" size={16} color={theme.colors.accent} />
                      <Text style={styles.secondaryActionText}>{t('Navigate')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secondaryAction}
                      activeOpacity={0.88}
                      onPress={() => onNavigate?.('fundiBookingDetail', { bookingId: activeCard.id })}
                    >
                      <Ionicons name="information-circle-outline" size={16} color={theme.colors.textMuted} />
                      <Text style={styles.secondaryActionText}>{t('Details')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.black,
  },
  header: {
    backgroundColor: theme.colors.black,
    paddingHorizontal: 20,
    paddingBottom: 0,
    zIndex: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
    marginBottom: 8,
  },
  locationText: {
    color: theme.colors.white,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  headerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  greetingLine: {
    color: theme.colors.white,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    flex: 1,
    paddingRight: 12,
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    backgroundColor: theme.colors.bgLight,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 58,
    paddingBottom: 24,
  },
  clientModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardLight,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    ...cardShadow,
  },
  clientModeText: {
    flex: 1,
    marginLeft: 10,
  },
  clientModeTitle: {
    color: theme.colors.accent,
    fontWeight: '800',
    fontSize: 13,
  },
  clientModeSub: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardLight,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 14,
    marginBottom: -46,
    ...cardShadow,
  },
  statusLeft: {
    flex: 1,
    paddingRight: 12,
  },
  statusTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.textSubtle,
  },
  statusDotOnline: {
    backgroundColor: theme.colors.green,
  },
  statusTitle: {
    color: theme.colors.textDark,
    fontSize: 16,
    fontWeight: '800',
  },
  statusSub: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  miniStat: {
    flex: 1,
    backgroundColor: theme.colors.cardLight,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    ...cardShadow,
  },
  miniStatLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
  },
  miniStatValue: {
    color: theme.colors.textDark,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  miniStatValueAccent: {
    color: theme.colors.accentDark,
    fontSize: 15,
  },
  mainCard: {
    backgroundColor: theme.colors.cardLight,
    borderRadius: 16,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    ...cardShadow,
  },
  mainCardIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.bgLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  mainCardTitle: {
    color: theme.colors.textDark,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  mainCardMessage: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 280,
  },
  sectionBlock: {
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    color: theme.colors.textDark,
    fontSize: 16,
    fontWeight: '800',
  },
  sectionAction: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeCard: {
    backgroundColor: theme.colors.cardLight,
    borderRadius: 16,
    padding: 16,
    ...cardShadow,
  },
  activeTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  activeStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  smallDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  activeStatusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  startedText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  activeProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.bgLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: theme.colors.textDark,
    fontSize: 13,
    fontWeight: '800',
  },
  activeMeta: {
    flex: 1,
  },
  activeName: {
    color: theme.colors.textDark,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 20,
  },
  activeService: {
    color: theme.colors.green,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  activeAddress: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  priceChip: {
    alignItems: 'flex-end',
    marginLeft: 8,
    maxWidth: '42%',
  },
  priceChipLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  priceChipValue: {
    color: theme.colors.accentDark,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  priceChipPending: {
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  activeDescription: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
  },
  stepTrack: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 14,
  },
  stepSeg: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.bgLight,
  },
  stepSegDone: {
    backgroundColor: theme.colors.green,
  },
  stepSegCurrent: {
    backgroundColor: theme.colors.accent,
  },
  progressRow: {
    marginTop: 8,
  },
  progressText: {
    color: theme.colors.green,
    fontSize: 13,
    fontWeight: '700',
  },
  awaitingText: {
    color: theme.colors.accentDark,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  finishText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  primaryAction: {
    height: 50,
    borderRadius: 999,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  primaryActionText: {
    color: theme.colors.textDark,
    fontSize: 14,
    fontWeight: '800',
  },
  actionDisabled: {
    opacity: 0.55,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  secondaryAction: {
    flex: 1,
    minWidth: 0,
    height: 42,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: theme.colors.bgLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  secondaryActionText: {
    color: theme.colors.textDark,
    fontSize: 12,
    fontWeight: '700',
  },
  requestCard: {
    backgroundColor: theme.colors.cardLight,
    borderRadius: 16,
    padding: 14,
    ...cardShadow,
  },
  requestBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  requestUrgentBadge: {
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 999,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestUrgentText: {
    color: theme.colors.textDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  requestPrice: {
    color: theme.colors.accentDark,
    fontSize: 18,
    fontWeight: '900',
  },
  requestPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  requestDistance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  requestDistanceText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  requestProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  requestAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.bgLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestAvatarText: {
    color: theme.colors.textDark,
    fontSize: 11,
    fontWeight: '800',
  },
  requestMeta: {
    flex: 1,
  },
  requestName: {
    color: theme.colors.textDark,
    fontSize: 16,
    fontWeight: '800',
  },
  requestSummary: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  requestAddress: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  declineButton: {
    width: 96,
    height: 44,
    borderRadius: 999,
    backgroundColor: theme.colors.bgLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButtonText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  acceptButton: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    backgroundColor: theme.colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  acceptButtonText: {
    color: theme.colors.textDark,
    fontSize: 14,
    fontWeight: '900',
  },
});
