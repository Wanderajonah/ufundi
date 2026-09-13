import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import ScreenWrapper from '../components/ScreenWrapper';
import PrimaryButton from '../components/PrimaryButton';
import FundiMap from '../components/FundiMap';
import theme from '../theme';
import { fc, fundiCardShadow } from '../fundiTheme';
import { useLanguage } from '../i18n/LanguageContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getFundiBookingById,
  updateBookingStatus,
  updateFundiLocation,
  getErrorMessage,
} from '../../services/bookingsApi';
import { getRoutePreview } from '../../services/mapsApi';

// Re-query the route once the fundi has drifted this far from the last query.
const ROUTE_REFRESH_M = 80;
// Push the fundi's position to the backend at most this often (client
// tracking reads booking.fundiLocation).
const SYNC_MIN_INTERVAL_MS = 15000;

export default function FundiNavigationScreen({
  route: navRoute,
  onNavigate,
}) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const bookingId = navRoute?.params?.bookingId;

  const [booking, setBooking] = useState(navRoute?.params?.booking || null);
  const [loading, setLoading] = useState(!navRoute?.params?.booking);
  const [myCoords, setMyCoords] = useState(null);
  const [gpsError, setGpsError] = useState('');
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [arriving, setArriving] = useState(false);

  const watchRef = useRef(null);
  const lastRouteQueryRef = useRef(null);
  const lastSyncRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    if (!booking && bookingId) {
      (async () => {
        try {
          const { data } = await getFundiBookingById(bookingId);
          if (!cancelled) setBooking(data?.booking || data || null);
        } catch (e) {
          if (!cancelled) {
            Alert.alert(t('Could not load job'), getErrorMessage(e), [
              { text: t('Go back'), onPress: () => onNavigate?.('fundiDashboard') },
            ]);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  const destination = useMemo(() => {
    const loc = booking?.location;
    if (!loc || loc.lat == null || loc.lng == null) return null;
    return { lat: Number(loc.lat), lng: Number(loc.lng) };
  }, [booking]);

  // Watch the fundi's GPS; mirror it to the backend for client tracking.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!cancelled) setGpsError(t('Location permission is needed to navigate.'));
        return;
      }
      const watch = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
        (pos) => {
          if (cancelled) return;
          const coords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          setMyCoords(coords);
          setGpsError('');

          const now = Date.now();
          if (now - lastSyncRef.current > SYNC_MIN_INTERVAL_MS && bookingId) {
            lastSyncRef.current = now;
            updateFundiLocation(coords.lat, coords.lng).catch(() => {});
          }
        },
      );
      watchRef.current = watch;
    })();
    return () => {
      cancelled = true;
      watchRef.current?.remove?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  const loadRoute = async (from) => {
    if (!from || !destination) return;
    const key = `${from.lat.toFixed(4)},${from.lng.toFixed(4)}`;
    if (key === lastRouteQueryRef.current) return;
    lastRouteQueryRef.current = key;
    setRouteLoading(true);
    try {
      const { data } = await getRoutePreview({
        fromLat: from.lat,
        fromLng: from.lng,
        toLat: destination.lat,
        toLng: destination.lng,
      });
      setRouteInfo({
        distanceKm: data?.distanceKm ?? null,
        etaMinutes: data?.etaMinutes ?? null,
        polyline: Array.isArray(data?.polyline) ? data.polyline : null,
      });
    } catch {
      setRouteInfo(null);
    } finally {
      setRouteLoading(false);
    }
  };

  // Initial + drift-based route refresh.
  useEffect(() => {
    if (!myCoords || !destination) return;
    loadRoute(myCoords);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    myCoords?.lat?.toFixed(4),
    myCoords?.lng?.toFixed(4),
    destination?.lat,
    destination?.lng,
  ]);

  // Straight-line fallback when no driving polyline came back.
  const routeLine = useMemo(() => {
    if (routeInfo?.polyline?.length > 1) return routeInfo.polyline;
    if (myCoords && destination) return [myCoords, destination];
    return null;
  }, [routeInfo, myCoords, destination]);

  const handleArrived = async () => {
    if (!booking?.id && !booking?._id) return;
    setArriving(true);
    try {
      await updateBookingStatus(booking.id || booking._id, 'ARRIVED');
      Alert.alert(
        t('You have arrived'),
        t('Mark the job as started from your dashboard when you begin work.'),
        [{ text: t('OK'), onPress: () => onNavigate?.('fundiDashboard') }],
      );
    } catch (e) {
      Alert.alert(t('Could not update status'), getErrorMessage(e));
    } finally {
      setArriving(false);
    }
  };

  const mapRegion = useMemo(() => {
    if (myCoords && destination) {
      return {
        latitude: (myCoords.lat + destination.lat) / 2,
        longitude: (myCoords.lng + destination.lng) / 2,
        latitudeDelta:
          Math.max(0.01, Math.abs(myCoords.lat - destination.lat) * 2.2),
        longitudeDelta:
          Math.max(0.012, Math.abs(myCoords.lng - destination.lng) * 2.2),
      };
    }
    if (destination) {
      return {
        latitude: destination.lat,
        longitude: destination.lng,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      };
    }
    return undefined;
  }, [myCoords, destination]);

  if (loading) {
    return (
      <ScreenWrapper style={styles.safe}>
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper style={styles.safe} edges={['top', 'left', 'right']}>
      <FundiMap
        style={StyleSheet.absoluteFill}
        region={mapRegion}
        // Fall back to the destination so the map renders before the first GPS fix.
        currentLocation={myCoords || destination}
        destination={
          destination
            ? { lat: destination.lat, lng: destination.lng, title: booking?.clientName || t('Client') }
            : null
        }
        routeCoords={routeLine}
      />

      <View style={[styles.topCard, { marginTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => onNavigate?.('fundiDashboard')}
        >
          <Ionicons name="close" size={20} color={fc.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.topLabel}>{t('Navigating to')}</Text>
          <Text style={styles.topName} numberOfLines={1}>
            {booking?.clientName || t('Client')}
          </Text>
          {booking?.address ? (
            <Text style={styles.topAddress} numberOfLines={1}>{booking.address}</Text>
          ) : null}
        </View>
      </View>

      {(gpsError || !destination) && (
        <View style={[styles.warnBox, { top: insets.top + 84 }]}>
          <Ionicons name="warning-outline" size={14} color={theme.colors.accent} />
          <Text style={styles.warnText}>
            {!destination
              ? t("This booking has no client coordinates on the map.")
              : gpsError}
          </Text>
        </View>
      )}

      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.etaRow}>
          <View style={styles.etaChip}>
            <Ionicons name="navigate" size={15} color={theme.colors.accent} />
            <Text style={styles.etaValue}>
              {routeInfo?.distanceKm != null ? `≈ ${routeInfo.distanceKm} km` : t('—')}
            </Text>
            <Text style={styles.etaLabel}>{t('away')}</Text>
          </View>
          <View style={styles.etaChip}>
            <Ionicons name="time-outline" size={15} color={theme.colors.accent} />
            <Text style={styles.etaValue}>
              {routeInfo?.etaMinutes != null ? t('{{mins}} min', { mins: routeInfo.etaMinutes }) : t('—')}
            </Text>
            <Text style={styles.etaLabel}>{t('ETA')}</Text>
          </View>
          {routeLoading ? (
            <ActivityIndicator size="small" color={theme.colors.mutedDark} style={{ marginLeft: 'auto' }} />
          ) : null}
        </View>

        <PrimaryButton
          onPress={handleArrived}
          disabled={arriving}
          loading={arriving}
          icon="checkmark-circle-outline"
          style={styles.arriveBtn}
        >
          {t('I have arrived')}
        </PrimaryButton>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.black },
  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 14,
    padding: 12,
    borderRadius: theme.radius.lg,
    backgroundColor: fc.card,
    borderWidth: 1,
    borderColor: fc.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: fc.page,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topLabel: { color: fc.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  topName: { color: fc.text, fontSize: 15, fontWeight: '900', marginTop: 1 },
  topAddress: { color: fc.textMuted, fontSize: 12, marginTop: 2 },
  warnBox: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(255,184,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.3)',
  },
  warnText: { color: fc.accentDark, fontSize: 12, fontWeight: '700', flex: 1 },
  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: fc.card,
    borderTopWidth: 1,
    borderTopColor: fc.border,
  },
  etaRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  etaChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: fc.page,
    borderWidth: 1,
    borderColor: fc.border,
  },
  etaValue: { color: fc.text, fontSize: 16, fontWeight: '900' },
  etaLabel: { color: fc.textMuted, fontSize: 11, fontWeight: '700' },
  arriveBtn: { height: 54 },
});
