import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  StatusBar,
  ScrollView,
  ImageBackground,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import ScreenWrapper from "../components/ScreenWrapper";
import LoadingSkeleton from "../components/LoadingSkeleton";
import HomeSection from "../components/HomeSection";
import { formatUgx, formatBookingDate } from "../utils/ratings";
import { getWallet } from "../../services/walletApi";
import theme from "../theme";
import { useBookingOptional } from "../../context/BookingContext";
import { useNotificationsOptional } from "../../context/NotificationContext";
import { useLocation } from "../../context/LocationContext";
import { useLanguage } from "../i18n/LanguageContext";
import { bookingRoute, bookingToActiveJob } from "../utils/bookings";

const H_PAD = 20;

const STATUS_COLORS = {
  COMPLETED: { bg: "rgba(52,199,89,0.15)", fg: theme.colors.green },
  CANCELLED: { bg: "rgba(255,69,58,0.15)", fg: theme.colors.red },
  DISPUTED: { bg: "rgba(255,69,58,0.15)", fg: theme.colors.red },
};

const CATEGORIES = [
  { key: "plumber", label: "Plumbing", icon: "water-outline" },
  { key: "electrician", label: "Electrician", icon: "flash-outline" },
  { key: "carpenter", label: "Carpenter", icon: "hammer-outline" },
  { key: "painter", label: "Painter", icon: "color-palette-outline" },
];

const HERO_SLIDES = [
  {
    key: "trusted",
    image:
      "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=900&q=75&fm=jpg",
    title: "Verified fundis you can trust",
    sub: "ID-checked, skill-tested professionals near you",
    cta: "Find a Fundi",
    action: "browse",
  },
  {
    key: "booking",
    image:
      "https://images.unsplash.com/photo-1688372198189-de6a51777a81?w=900&q=75&fm=jpg",
    title: "Book a fundi in minutes",
    sub: "Plumbing, electrical, carpentry and more on demand",
    cta: "Request a Service",
    action: "book",
  },
  {
    key: "escrow",
    image:
      "https://images.unsplash.com/photo-1687422811062-a966b55cb217?w=900&q=75&fm=jpg",
    title: "Pay safely with escrow",
    sub: "Money is released only when the job is done right",
    cta: "How It Works",
    action: "help",
  },
];

function HeroSlider({ onNavigate }) {
  const { t } = useLanguage();
  const { width: screenWidth } = useWindowDimensions();
  const slideWidth = Math.max(200, screenWidth - H_PAD * 2);

  const N = HERO_SLIDES.length;
  const BASE = N; // start offset — the middle copy of the tripled list
  const slides = useMemo(
    () => [...HERO_SLIDES, ...HERO_SLIDES, ...HERO_SLIDES],
    [],
  );

  const scrollRef = useRef(null);
  const posRef = useRef(BASE);
  const [index, setIndex] = useState(0);

  // Center on the middle copy (identical visuals to the leftmost, so no flash).
  useEffect(() => {
    posRef.current = BASE;
    setIndex(0);
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: BASE * slideWidth, animated: false });
    }, 50);
    return () => clearTimeout(id);
  }, [slideWidth]);

  const applyPage = (page, animated) => {
    scrollRef.current?.scrollTo({ x: page * slideWidth, animated });
  };

  // Silently snap back into the middle copy — the two frames are pixel-identical,
  // so the swap is invisible and the loop feels endless.
  const normalizeToBase = () => {
    const logical = ((posRef.current % N) + N) % N;
    const basePage = BASE + logical;
    if (posRef.current !== basePage) {
      applyPage(basePage, false);
      posRef.current = basePage;
    }
  };

  const step = (dir) => {
    normalizeToBase();
    const target = posRef.current + dir;
    posRef.current = target;
    setIndex(((target % N) + N) % N);
    applyPage(target, true);
  };

  useEffect(() => {
    const timer = setInterval(() => step(1), 4500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideWidth]);

  const handleMomentumEnd = (e) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / slideWidth);
    posRef.current = page;
    setIndex(((page % N) + N) % N);
    normalizeToBase();
  };

  return (
    <View style={[styles.heroBanner, { width: slideWidth }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        decelerationRate="fast"
      >
        {slides.map((slide, i) => (
          <TouchableOpacity
            key={`${slide.key}-${i}`}
            activeOpacity={0.95}
            onPress={() => onNavigate?.(slide.action)}
          >
            <ImageBackground
              source={{ uri: slide.image }}
              style={[styles.heroImage, { width: slideWidth }]}
              resizeMode="cover"
            >
              <LinearGradient
                colors={["rgba(0,0,0,0.38)", "rgba(0,0,0,0.6)", "rgba(0,0,0,0.92)"]}
                locations={[0, 0.45, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.heroOverlay}
              >
                <View style={styles.heroContent}>
                  <Text style={styles.heroTitle} numberOfLines={1}>
                    {t(slide.title)}
                  </Text>
                  <Text style={styles.heroSub} numberOfLines={1}>
                    {t(slide.sub)}
                  </Text>
                  <View style={styles.heroFooterRow}>
                    <View style={styles.heroBtn}>
                      <Text style={styles.heroBtnText}>{t(slide.cta)}</Text>
                    </View>
                    <View style={styles.dotsRow}>
                      {HERO_SLIDES.map((s, d) => (
                        <View
                          key={s.key}
                          style={[styles.dot, d === index && styles.dotActive]}
                        />
                      ))}
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </ImageBackground>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.arrowsWrap} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.arrowBtn}
          activeOpacity={0.8}
          onPress={() => step(1)}
        >
          <Ionicons name="chevron-forward" size={14} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.arrowBtn}
          activeOpacity={0.8}
          onPress={() => step(-1)}
        >
          <Ionicons name="chevron-back" size={14} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ListHeader({ userName, userRole, fundiEnabled, onNavigate, onSwitchToFundiMode, locationLabel, activeJob, activeJobs, bookingsLoading, walletBalance, unreadCount }) {
  const { t } = useLanguage();
  const bookingCtx = useBookingOptional();

  // Route by the booking's CURRENT server state, not where the banner assumes.
  const openActiveBooking = async (bookingId) => {
    const fresh = bookingId
      ? await bookingCtx?.refreshBookingById?.(bookingId)
      : null;
    const route = bookingRoute(fresh || null);
    if (!route) {
      onNavigate?.("jobInProgress");
      return;
    }
    onNavigate?.(route.key, route.params);
  };

  // One banner per concurrent in-progress job so a second active booking
  // never hides the first.
  const inProgressJobs = (activeJobs || []).filter(
    (b) => String(b.status).toLowerCase() === "in_progress"
  );

  const [showBalance, setShowBalance] = useState(true);
  return (
    <View>
      {/* 1. Header Row — logo + bell + balance below bell */}
      <View style={styles.headerRow}>
        <View style={styles.brandWrap}>
          <Text style={styles.brandName}>Ufundi</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => onNavigate?.("notifications")}
            activeOpacity={0.85}
          >
            <Ionicons name="notifications-outline" size={22} color={theme.colors.accent} />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Location + Balance row */}
      <View style={styles.locBalanceRow}>
        <TouchableOpacity
          style={styles.locationPill}
          activeOpacity={0.85}
          onPress={() => onNavigate?.("setLocation")}
        >
          <Ionicons name="location-outline" size={14} color={theme.colors.green} />
          <Text style={styles.locationText} numberOfLines={1}>
            {locationLabel || t('Set your location')}
          </Text>
        </TouchableOpacity>
        {walletBalance !== null ? (
          <View style={styles.balanceRow}>
            <TouchableOpacity onPress={() => setShowBalance((p) => !p)} activeOpacity={0.7}>
              <Ionicons
                name={showBalance ? "eye-outline" : "eye-off-outline"}
                size={16}
                color={theme.colors.mutedDark}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onNavigate?.("wallet")}
              activeOpacity={0.85}
            >
              <Text style={styles.balanceText}>
                {showBalance ? `UGX ${(walletBalance || 0).toLocaleString()}` : "UGX ••••••"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onNavigate?.("wallet")} activeOpacity={0.85}>
              <View style={styles.addIcon}>
                <Ionicons name="add" size={12} color={theme.colors.textDark} />
              </View>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {/* Active booking banners — one per in-progress job */}
      {inProgressJobs.map((job) => (
        <TouchableOpacity
          key={job.id}
          style={styles.activeBanner}
          onPress={() => openActiveBooking(job.id)}
          activeOpacity={0.9}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.activeBannerTitle}>
              {t('Active booking')} · {job.service}
            </Text>
            <Text style={styles.activeBannerSub}>
              {job.fundiName} · {formatUgx(job.amount)}
            </Text>
          </View>
          <Text style={styles.activeBannerCta}>{t('Open')}</Text>
        </TouchableOpacity>
      ))}

      {/* Fundi mode switch for dual-role users */}
      {fundiEnabled && userRole === "customer" ? (
        <TouchableOpacity
          style={styles.fundiModeBanner}
          onPress={() => onSwitchToFundiMode?.()}
          activeOpacity={0.85}
        >
          <Ionicons name="briefcase-outline" size={20} color={theme.colors.accent} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.fundiModeTitle}>{t('Fundi Mode')}</Text>
            <Text style={styles.fundiModeSub}>{t('Switch to fundi view to manage jobs')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.mutedDark} />
        </TouchableOpacity>
      ) : null}

      {/* 2. Search Bar */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={theme.colors.muted} />
        <TextInput
          placeholder={t('What service do you need?')}
          placeholderTextColor={theme.colors.mutedDark}
          style={styles.searchInput}
          onFocus={() => onNavigate?.("browse")}
        />
      </View>

      {/* 3. Hero Banner — auto-advancing slider */}
      <HeroSlider onNavigate={onNavigate} />

      {/* 4. Services Section */}
      <HomeSection title={t('Services')} style={styles.sectionGap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.servicesScroll}
        >
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.key}
              style={styles.serviceBtn}
              activeOpacity={0.8}
              onPress={() => onNavigate?.("browse", { category: c.key })}
            >
              <View style={styles.serviceIconWrap}>
                <Ionicons name={c.icon} size={24} color={theme.colors.accent} />
              </View>
              <Text style={styles.serviceLabel}>{t(c.label)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </HomeSection>

      {/* 5. Recent Bookings */}
      <HomeSection
        title={t('Recent Bookings')}
        onAction={() => onNavigate?.("bookings")}
        style={styles.sectionGap}
      >
        {bookingsLoading ? <LoadingSkeleton count={2} /> : null}
      </HomeSection>

    </View>
  );
}

function BookingCard({ item, onPress }) {
  const palette = STATUS_COLORS[item.status] || { bg: "rgba(255,184,0,0.12)", fg: theme.colors.accent };
  const counterpart = item.fundiName || item.clientName || "Fundi";
  return (
    <TouchableOpacity
      style={styles.bookingCard}
      activeOpacity={0.9}
      onPress={onPress}
    >
      <View style={styles.bookingIcon}>
        <Ionicons name="construct-outline" size={22} color={theme.colors.accent} />
      </View>
      <View style={styles.fundiBody}>
        <Text style={styles.bookingService} numberOfLines={1}>
          {item.service || "Service"}
        </Text>
        <Text style={styles.bookingSub} numberOfLines={1}>
          {counterpart}
        </Text>
        <View style={styles.bookingMeta}>
          <View style={[styles.bookingStatus, { backgroundColor: palette.bg }]}>
            <Text style={[styles.bookingStatusText, { color: palette.fg }]}>
              {item.statusLabel || item.status}
            </Text>
          </View>
          {item.createdAt ? (
            <Text style={styles.bookingDate}>{formatBookingDate(item.createdAt)}</Text>
          ) : null}
        </View>
      </View>
      {item.total ? (
        <View style={styles.bookingAmountWrap}>
          <Text style={styles.bookingAmount}>{formatUgx(item.total)}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export default function HomeScreen({
  userName = "User",
  userRole = "customer",
  fundiEnabled,
  activeJob,
  onNavigate,
  onSwitchToFundiMode,
}) {
  const bookingCtx = useBookingOptional();
  const notificationCtx = useNotificationsOptional();
  const unreadCount = notificationCtx?.unreadCount || 0;
  const resolvedActiveJob = bookingCtx?.activeJob || activeJob;
  // All concurrent active bookings, mapped to the job shape used for banners.
  const resolvedActiveJobs = (bookingCtx?.activeBookings || []).map(bookingToActiveJob).filter(Boolean);
  const { address } = useLocation();
  const { t } = useLanguage();
  const [walletBalance, setWalletBalance] = useState(null);

  const recentBookings = useMemo(() => {
    const list = bookingCtx?.bookings || [];
    const seen = new Set();
    return [...list]
      .filter(Boolean)
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      )
      .filter((b) => {
        if (!b.fundiId) return true;
        if (seen.has(b.fundiId)) return false;
        seen.add(b.fundiId);
        return true;
      })
      .slice(0, 3);
  }, [bookingCtx?.bookings]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await getWallet();
        if (!cancelled) setWalletBalance(data.wallet?.balance ?? null);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <ScreenWrapper style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={theme.colors.black}
      />
      <FlatList
        data={recentBookings}
        keyExtractor={(i) => String(i.id)}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <ListHeader
            userName={userName}
            userRole={userRole}
            fundiEnabled={fundiEnabled}
            onNavigate={onNavigate}
            onSwitchToFundiMode={onSwitchToFundiMode}
            locationLabel={address}
            activeJob={resolvedActiveJob}
            activeJobs={resolvedActiveJobs}
            bookingsLoading={bookingCtx?.loading}
            walletBalance={walletBalance}
            unreadCount={unreadCount}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 24 },
        ]}
        ListEmptyComponent={
          !bookingCtx?.loading ? (
            <View style={styles.noBookings}>
              <Ionicons name="calendar-outline" size={28} color={theme.colors.mutedDark} />
              <Text style={styles.noFundisTitle}>{t('No bookings yet')}</Text>
              <Text style={styles.noFundisSub}>{t('Book a fundi and your bookings will show up here')}</Text>
              <TouchableOpacity style={styles.browseAllBtn} onPress={() => onNavigate?.("browse")}>
                <Text style={styles.browseAllText}>{t('Book a Fundi')}</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <BookingCard
            item={item}
            onPress={() => onNavigate?.("bookings")}
          />
        )}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.black },
  listContent: { paddingHorizontal: H_PAD, paddingTop: 16 },

  /* Header */
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  brandName: {
    color: theme.colors.white,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.glass,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  notifBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: theme.colors.red,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: theme.colors.bgDark,
  },
  notifBadgeText: {
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: "900",
  },

  /* Location + Balance row */
  locBalanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  /* Location */
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.input,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  locationText: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: "600",
    maxWidth: 260,
  },

  /* Header right */
  headerRight: { flexDirection: "column", alignItems: "flex-end", gap: 4 },

  /* Balance row — eye + amount + add */
  balanceRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  balanceText: { color: theme.colors.accent, fontWeight: "900", fontSize: 13 },
  addIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },

  /* Active banner */
  activeBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,184,0,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,184,0,0.25)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    ...theme.elevation.md,
  },
  activeBannerTitle: { color: theme.colors.white, fontWeight: "800", fontSize: 14 },
  activeBannerSub: { color: theme.colors.muted, fontSize: 12, marginTop: 4 },
  activeBannerCta: { color: theme.colors.accent, fontWeight: "800", fontSize: 14 },

  /* Fundi mode banner */
  fundiModeBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,184,0,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,184,0,0.2)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  fundiModeTitle: { color: theme.colors.accent, fontWeight: "800", fontSize: 13 },
  fundiModeSub: { color: theme.colors.muted, fontSize: 11, marginTop: 2 },

  /* Search */
  searchWrap: {
    height: 50,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
    backgroundColor: theme.colors.input,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 20,
    ...theme.elevation.sm,
  },
  searchInput: { flex: 1, color: theme.colors.white, fontSize: 15 },

  /* Hero Banner */
  heroBanner: {
    height: 150,
    borderRadius: 14,
    overflow: "hidden",
    alignSelf: "center",
    marginBottom: 24,
    ...theme.elevation.lg,
  },
  arrowsWrap: {
    position: "absolute",
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    gap: 6,
  },
  arrowBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroImage: { height: "100%" },
  heroOverlay: { flex: 1, justifyContent: "flex-end", padding: 16 },
  heroContent: { gap: 5 },
  heroTitle: {
    color: theme.colors.white,
    fontSize: 15,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroSub: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 11.5,
    fontWeight: "600",
    marginBottom: 4,
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dotsRow: { flexDirection: "row", gap: 5 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  dotActive: {
    width: 16,
    backgroundColor: theme.colors.accent,
  },
  heroBtn: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    ...theme.elevation.md,
  },
  heroBtnText: { color: theme.colors.textDark, fontWeight: "800", fontSize: 14 },

  /* Services */
  sectionGap: { marginBottom: 20 },
  servicesScroll: { gap: 16, paddingRight: H_PAD },
  serviceBtn: { alignItems: "center", width: 72 },
  serviceIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,184,0,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,184,0,0.1)",
  },
  serviceLabel: { color: theme.colors.muted, fontSize: 12, fontWeight: "600", textAlign: "center" },

  /* Booking Card */
  bookingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.panel,
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  bookingIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,184,0,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  fundiBody: { flex: 1 },
  bookingService: { color: theme.colors.white, fontSize: 15, fontWeight: "800", flexShrink: 1 },
  bookingSub: { color: theme.colors.muted, fontSize: 12, marginTop: 2 },
  bookingMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  bookingStatus: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bookingStatusText: { fontWeight: "800", fontSize: 11 },
  bookingDate: { color: theme.colors.mutedDark, fontSize: 11, fontWeight: "600" },
  bookingAmountWrap: { marginLeft: 8 },
  bookingAmount: { color: theme.colors.accent, fontWeight: "900", fontSize: 13 },

  /* No bookings */
  noBookings: {
    alignItems: "center",
    paddingVertical: 24,
    backgroundColor: theme.colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
  },
  noFundisTitle: { color: theme.colors.white, fontWeight: "800", fontSize: 15, marginTop: 10 },
  noFundisSub: { color: theme.colors.mutedDark, fontSize: 12, textAlign: "center", marginTop: 4, paddingHorizontal: 20 },
  browseAllBtn: {
    marginTop: 14,
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  browseAllText: { color: theme.colors.textDark, fontWeight: "800", fontSize: 13 },
});
