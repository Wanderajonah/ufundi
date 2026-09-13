import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { fc, fundiCardShadow } from '../fundiTheme';
import FundiThemedScreen from '../components/FundiThemedScreen';
import PrimaryButton from '../components/PrimaryButton';
import BookingStatusSteps from '../components/BookingStatusSteps';
import PriceNegotiationSection from '../components/PriceNegotiationSection';
import {
  updateBookingStatus,
  negotiateFundiPrice,
  cancelFundiBooking,
  acceptBooking,
  getErrorMessage,
} from '../../services/bookingsApi';
import { emitSocket } from '../../services/socketService';
import { useBooking } from '../../context/BookingContext';
import { FUNDI_STATUS_ACTIONS, BOOKING_STATUS_LABELS, FUNDI_STATUS_TINT } from '../utils/bookings';
import { formatUgx, initials } from '../utils/ratings';
import { resolveMediaUrl } from '../../utils/image';
import { useLanguage } from '../i18n/LanguageContext';

const STATUS_ORDER = ['ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'];

const TERMINAL_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'DISPUTED']);

export default function FundiBookingDetailScreen({ bookingId, onBack }) {
  const { activeBooking, setPendingRequest, setActiveBooking, refreshBookingById, refreshBookings } = useBooking();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [acceptLoading, setAcceptLoading] = useState(false);
  const [error, setError] = useState('');
  const [localBooking, setLocalBooking] = useState(null);

  const booking =
    activeBooking?.id === bookingId ? activeBooking : localBooking;

  useEffect(() => {
    if (!bookingId) return;
    refreshBookingById(bookingId).then((result) => {
      if (result) setLocalBooking(result);
    });
  }, [bookingId, refreshBookingById]);

  // Safety net: re-fetch during negotiation so client proposals show up
  // even when a socket event is missed.
  const negotiating =
    booking?.status === 'ACCEPTED' && !booking?.priceAgreed;
  useEffect(() => {
    if (!negotiating || !bookingId) return undefined;
    const id = setInterval(() => {
      refreshBookingById(bookingId).then((result) => {
        if (result) setLocalBooking(result);
      });
    }, 8000);
    return () => clearInterval(id);
  }, [negotiating, bookingId, refreshBookingById]);

  // While waiting for the client's completion confirmation, keep the
  // booking fresh so the screen flips to Completed on its own.
  const awaitingClientConfirm = Boolean(
    booking &&
      !TERMINAL_STATUSES.has(booking.status) &&
      booking.fundiCompleted &&
      !booking.clientCompleted,
  );
  useEffect(() => {
    if (!awaitingClientConfirm || !bookingId) return undefined;
    const id = setInterval(() => {
      refreshBookingById(bookingId).then((result) => {
        if (result) setLocalBooking(result);
      });
    }, 8000);
    return () => clearInterval(id);
  }, [awaitingClientConfirm, bookingId, refreshBookingById]);

  const handleAccept = async () => {
    if (!bookingId) return;
    setAcceptLoading(true);
    setError('');
    try {
      await acceptBooking(bookingId);
      emitSocket('accept_booking', { bookingId });
      setPendingRequest(null);
      await refreshBookingById(bookingId);
      await refreshBookings();
      Alert.alert(t('Booking accepted'), t('The booking has been accepted. Update your status when you are on the way.'));
    } catch (e) {
      const msg = getErrorMessage(e);
      setError(msg);
      Alert.alert(t('Could not accept'), msg);
    } finally {
      setAcceptLoading(false);
    }
  };

  const handleStatusUpdate = async (status) => {
    setLoading(true);
    setError('');
    try {
      const res = await updateBookingStatus(bookingId, status);
      const booking = res?.data?.booking;
      await refreshBookingById(bookingId);
      if (status === 'COMPLETED' && booking && booking.status !== 'COMPLETED') {
        Alert.alert(
          t('Waiting for client'),
          t(
            'You confirmed the job. Payment is released as soon as the client confirms too.'
          )
        );
      } else {
        Alert.alert(t('Status updated'), t('Booking marked as {{label}}.', { label: BOOKING_STATUS_LABELS[status] || status }));
      }
    } catch (e) {
      const msg = getErrorMessage(e);
      setError(msg);
      Alert.alert(t('Status update failed'), msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePropose = async (price) => {
    setPriceLoading(true);
    setError('');
    try {
      await negotiateFundiPrice(bookingId, { price, action: 'propose' });
      await refreshBookingById(bookingId);
    } catch (e) {
      const msg = getErrorMessage(e);
      setError(msg);
      Alert.alert(t('Price proposal failed'), msg);
    } finally {
      setPriceLoading(false);
    }
  };

  const handleAgree = async () => {
    setPriceLoading(true);
    setError('');
    try {
      await negotiateFundiPrice(bookingId, { action: 'agree' });
      await refreshBookingById(bookingId);
    } catch (e) {
      const msg = getErrorMessage(e);
      setError(msg);
      Alert.alert(t('Could not agree on price'), msg);
    } finally {
      setPriceLoading(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(t('Cancel booking'), t('Are you sure you want to cancel this booking?'), [
      { text: t('Keep'), style: 'cancel' },
      {
        text: t('Cancel booking'),
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await cancelFundiBooking(bookingId, 'Cancelled by fundi');
            emitSocket('cancel_booking', { bookingId, reason: 'Cancelled by fundi' });
            // Explicitly clear context state before navigating back so the
            // dashboard immediately reflects the cancelled booking.
            setActiveBooking((prev) =>
              prev && prev.id === bookingId ? null : prev
            );
            setPendingRequest(null);
            await refreshBookings();
            onBack?.();
          } catch (e) {
            const msg = getErrorMessage(e);
            setError(msg);
            Alert.alert(t('Could not cancel'), msg);
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const retry = useCallback(() => refreshBookingById(bookingId), [bookingId, refreshBookingById]);

  if (!booking || booking.id !== bookingId) {
    return (
      <FundiThemedScreen title={t('Job Details')} onBack={onBack} scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} size="large" />
          <Text style={styles.loadingText}>{t('Loading booking…')}</Text>
          {error ? (
            <TouchableOpacity onPress={retry}>
              <Text style={styles.retry}>{t('Retry')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </FundiThemedScreen>
    );
  }

  const isTerminal = TERMINAL_STATUSES.has(booking.status);
  const isPending = booking.status === 'PENDING';
  const isAccepted = booking.status === 'ACCEPTED';
  const currentIdx = STATUS_ORDER.indexOf(booking.status);

  // Completion has been confirmed by at least one side: the job can no
  // longer be cancelled, even while the status still reads IN_PROGRESS.
  const completionStarted = Boolean(booking.clientCompleted || booking.fundiCompleted);

  const nextActions = FUNDI_STATUS_ACTIONS.filter((a) => {
    const idx = STATUS_ORDER.indexOf(a.status);
    return idx === currentIdx + 1 || (booking.status === 'ACCEPTED' && a.status === 'ON_THE_WAY');
  });

  const tint = FUNDI_STATUS_TINT[booking.status] || FUNDI_STATUS_TINT.PENDING;

  return (
    <FundiThemedScreen title={t('Job Details')} onBack={onBack}>
        <View style={styles.statusHeader}>
          <View style={[styles.statusPill, { backgroundColor: tint.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: tint.fg }]} />
            <Text style={[styles.statusPillText, { color: tint.fg }]}>{t(booking.statusLabel)}</Text>
          </View>
        </View>

        <View style={styles.clientCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(booking.clientName)}</Text>
          </View>
          <View style={styles.clientMeta}>
            <Text style={styles.clientName}>{booking.clientName}</Text>
            <View style={styles.serviceRow}>
              <Ionicons name="construct-outline" size={13} color={theme.colors.green} />
              <Text style={styles.service}>{booking.service}</Text>
            </View>
            {booking.address ? (
              <View style={styles.addressRow}>
                <Ionicons name="location-outline" size={13} color={fc.textSubtle} />
                <Text style={styles.address} numberOfLines={2}>{booking.address}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.panel}>
          <DetailRow icon="document-text-outline" label={t('Description')} value={booking.description} />
          <DetailRow icon="cash-outline" label={t('Agreed price')} value={booking.agreedPrice ? formatUgx(booking.agreedPrice) : t('Not set')} highlight={Boolean(booking.agreedPrice)} />
          {booking.distanceKm != null ? (
            <DetailRow icon="navigate-outline" label={t('Distance')} value={t('{{distance}} km', { distance: booking.distanceKm })} />
          ) : null}
        </View>

        {booking.images?.length > 0 ? (
          <View style={styles.photoSection}>
            <Text style={styles.photoLabel}>{t('Photos from client')}</Text>
            <View style={styles.photoRow}>
              {booking.images.map((img, i) => (
                <Image key={i} source={{ uri: resolveMediaUrl(img) }} style={styles.photoThumb} />
              ))}
            </View>
          </View>
        ) : null}

        {!isPending ? <BookingStatusSteps booking={booking} /> : null}

        {isAccepted ? (
          <PriceNegotiationSection
            booking={booking}
            role="fundi"
            onPropose={handlePropose}
            onAgree={handleAgree}
            loading={priceLoading}
          />
        ) : null}

        {isPending ? (
          <>
            <Text style={styles.sectionTitle}>{t('Respond to booking request')}</Text>
            <PrimaryButton
              style={styles.statusBtn}
              onPress={handleAccept}
              disabled={acceptLoading}
            >
              {acceptLoading ? t('Accepting…') : t('Accept Booking')}
            </PrimaryButton>
          </>
        ) : null}

        {nextActions.length > 0 && !isTerminal ? (
          <>
            <Text style={styles.sectionTitle}>{t('Update status')}</Text>
            {nextActions.map((action) => (
              <PrimaryButton
                key={action.status}
                style={styles.statusBtn}
                onPress={() => handleStatusUpdate(action.status)}
                disabled={loading}
              >
                {loading ? t('Updating…') : t(action.label)}
              </PrimaryButton>
            ))}
          </>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={retry}>
              <Text style={styles.retry}>{t('Tap to retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!isTerminal && !completionStarted ? (
          <TouchableOpacity style={styles.cancelLink} onPress={handleCancel} disabled={loading}>
            <Ionicons name="close-circle-outline" size={18} color={theme.colors.red} />
            <Text style={styles.cancelText}>{t('Cancel booking')}</Text>
          </TouchableOpacity>
        ) : null}
    </FundiThemedScreen>
  );
}

function DetailRow({ icon, label, value, highlight = false }) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={16} color={theme.colors.accentDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={[styles.detailValue, highlight && styles.detailValueAccent]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, minHeight: 200 },
  loadingText: { color: fc.textMuted },
  statusHeader: { alignItems: 'flex-start', marginBottom: 16 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusDot: { width: 8, height: 8, borderRadius: 999 },
  statusPillText: { fontWeight: '800', fontSize: 12 },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: fc.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: fc.border,
    padding: 16,
    marginBottom: 16,
    ...fundiCardShadow,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,184,0,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: fc.accentDark, fontWeight: '900' },
  clientMeta: { flex: 1 },
  clientName: { color: fc.text, fontWeight: '800', fontSize: 16 },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  service: { color: theme.colors.green, fontSize: 13, fontWeight: '700' },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 4 },
  address: { color: fc.textMuted, fontSize: 12, flex: 1, lineHeight: 16 },
  panel: {
    backgroundColor: fc.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: fc.border,
    padding: 16,
    gap: 14,
    marginBottom: 16,
    ...fundiCardShadow,
  },
  detailRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(229,166,0,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: { color: fc.textMuted, fontSize: 11, fontWeight: '700' },
  detailValue: { color: fc.text, fontSize: 14, marginTop: 2 },
  detailValueAccent: { color: fc.accentDark, fontWeight: '800' },
  sectionTitle: { color: fc.text, fontWeight: '800', marginTop: 20, marginBottom: 10 },
  statusBtn: { marginBottom: 10 },
  errorBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  errorText: { color: theme.colors.red },
  retry: { color: theme.colors.accent, fontWeight: '700', marginTop: 8 },
  cancelLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
    padding: 12,
    borderRadius: theme.buttons.radius.md,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
  },
  cancelText: { color: theme.colors.red, fontWeight: '700' },
  photoSection: { marginTop: 16 },
  photoLabel: { color: fc.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 8 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoThumb: { width: 72, height: 72, borderRadius: 8 },
});
