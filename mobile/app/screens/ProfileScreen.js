import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import theme from '../theme';
import { fc, fundiCardShadow } from '../fundiTheme';
import ScreenWrapper from '../components/ScreenWrapper';
import { ProfileSkeleton } from '../components/LoadingSkeleton';
import { getProfile } from '../../services/usersApi';
import { resolveMediaUrl } from '../../utils/image';
import { initials } from '../utils/ratings';
import { useLanguage } from '../i18n/LanguageContext';

const VERIFY_MAP = {
  verified: {
    label: 'Verified',
    color: theme.colors.green,
    icon: 'shield-checkmark',
    bg: 'rgba(34,197,94,0.12)',
    border: 'rgba(34,197,94,0.35)',
  },
  pending: {
    label: 'Pending',
    color: theme.colors.accent,
    icon: 'time-outline',
    bg: 'rgba(255,184,0,0.12)',
    border: 'rgba(255,184,0,0.35)',
  },
  unverified: {
    label: 'Not Verified',
    color: theme.colors.mutedDark,
    icon: 'shield-checkmark-outline',
    bg: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.12)',
  },
  rejected: {
    label: 'Rejected',
    color: theme.colors.red,
    icon: 'shield-outline',
    bg: 'rgba(239,68,68,0.1)',
    border: 'rgba(239,68,68,0.35)',
  },
};

function Stat({ value, label, star, light }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, light && styles.statValueFundi]}>
        {value}
        {star ? <Text style={styles.statStar}> ★</Text> : null}
      </Text>
      <Text style={[styles.statLabel, light && styles.statLabelFundi]}>{label}</Text>
    </View>
  );
}

function VerificationChip({ status, onPress, light }) {
  const { t } = useLanguage();
  let info = VERIFY_MAP[status] || VERIFY_MAP.unverified;
  if (light && (status === 'unverified' || !status)) {
    info = {
      ...info,
      color: fc.textMuted,
      bg: 'rgba(0,0,0,0.04)',
      border: 'rgba(0,0,0,0.12)',
    };
  }
  return (
    <TouchableOpacity
      style={[styles.verifyChip, { backgroundColor: info.bg, borderColor: info.border }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.8}
    >
      <Ionicons name={info.icon} size={13} color={info.color} />
      <Text style={[styles.verifyChipText, { color: info.color }]}>{t(info.label)}</Text>
    </TouchableOpacity>
  );
}

function VerifyPromptCard({ status, notes, onPress, light }) {
  const { t } = useLanguage();
  if (status === 'verified') return null;

  if (status === 'pending') {
    return (
      <View style={[styles.verifyCard, light && styles.verifyCardFundi]}>
        <View style={styles.verifyCardIconWrap}>
          <Ionicons name="time-outline" size={22} color={theme.colors.accent} />
        </View>
        <View style={styles.verifyCardBody}>
          <Text style={[styles.verifyCardTitle, light && styles.verifyCardTitleFundi]}>
            {t('Verification in review')}
          </Text>
          <Text style={[styles.verifyCardText, light && styles.verifyCardTextFundi]}>
            {t("We're checking your documents. This usually takes 1–2 business days.")}
          </Text>
        </View>
      </View>
    );
  }

  const isRejected = status === 'rejected';
  return (
    <View
      style={[
        styles.verifyCard,
        light && styles.verifyCardFundi,
        isRejected && styles.verifyCardRejected,
        isRejected && light && styles.verifyCardRejectedFundi,
      ]}
    >
      <View style={styles.verifyCardIconWrap}>
        <Ionicons
          name={isRejected ? 'shield-outline' : 'shield-checkmark-outline'}
          size={22}
          color={isRejected ? theme.colors.red : theme.colors.accent}
        />
      </View>
      <View style={styles.verifyCardBody}>
        <Text style={[styles.verifyCardTitle, light && styles.verifyCardTitleFundi]}>
          {isRejected ? t('Verification rejected') : t('Get verified')}
        </Text>
        <Text style={[styles.verifyCardText, light && styles.verifyCardTextFundi]}>
          {isRejected
            ? t('Your documents were rejected. Submit new ones to get verified.')
            : t('Verified fundis build trust with clients and rank higher in search.')}
        </Text>
      </View>
      <TouchableOpacity style={styles.verifyCardBtn} onPress={onPress} activeOpacity={0.85}>
        <Text style={styles.verifyCardBtnText}>{isRejected ? t('Re-submit') : t('Verify')}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function ProfileScreen({
  userRole = 'customer',
  userName = 'User',
  userFullName,
  userEmail,
  onNavigate,
  onLogout,
}) {
  const isFundi = userRole === 'fundi';
  const { t } = useLanguage();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await getProfile();
        if (!cancelled) setProfile(data);
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const user = profile?.user || {};
  const fundiProfile = profile?.fundiProfile || {};
  const displayName =
    user.name ||
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    userFullName ||
    userName;
  const email = user.email || userEmail || '';
  const skills = fundiProfile.skills || [];
  const rating = fundiProfile.rating || 0;
  const completedJobs = fundiProfile.completedJobs || 0;
  const yearsExperience = fundiProfile.experience || 0;
  const trade = skills[0] || 'Fundi';
  const verificationStatus = fundiProfile.verificationStatus || 'unverified';

  const profilePhotoUri = user?.profilePhoto
    ? resolveMediaUrl(user.profilePhoto)
    : user?.avatarUrl || user?.avatar || user?.imageUrl || '';

  const coverPhotoUri = user?.coverPhoto
    ? resolveMediaUrl(user.coverPhoto)
    : user?.coverUrl || user?.coverImage || user?.backgroundImage || '';

  const handleMenu = (key) => {
    if (key === 'wallet') return onNavigate?.('wallet');
    if (key === 'history') return onNavigate?.('bookingHistory');
    if (key === 'notifications') return onNavigate?.('notifications');
    if (key === 'edit') return onNavigate?.('editProfile');
    if (key === 'settings') return onNavigate?.('settings');
    if (key === 'support') return onNavigate?.('help');
    if (key === 'skills') return onNavigate?.('skillsPortfolio');
    if (key === 'earnings') return onNavigate?.('bookings');
    if (key === 'verification') return onNavigate?.('verification');
    return Alert.alert(t('Coming soon'), t('This feature is on the way.'));
  };

  const accountItems = isFundi
    ? [
        { key: 'verification', label: 'Verification', icon: 'shield-checkmark-outline' },
        { key: 'wallet', label: 'Wallet', icon: 'wallet-outline' },
        { key: 'edit', label: 'Edit Fundi Profile', icon: 'person-outline' },
        { key: 'skills', label: 'Skills & Portfolio', icon: 'construct-outline' },
        { key: 'earnings', label: 'Earnings History', icon: 'cash-outline' },
      ]
    : [
        { key: 'wallet', label: 'Wallet', icon: 'wallet-outline' },
        { key: 'edit', label: 'Edit Profile', icon: 'person-outline' },
        { key: 'history', label: 'Booking History', icon: 'calendar-outline' },
      ];

  const generalItems = [
    { key: 'notifications', label: 'Notifications', icon: 'notifications-outline' },
    { key: 'support', label: 'Help & Support', icon: 'help-circle-outline' },
    { key: 'settings', label: 'Settings', icon: 'settings-outline' },
  ];

  return (
    <ScreenWrapper
      style={[styles.safe, isFundi && styles.safeFundi]}
      variant={isFundi ? 'fundi' : 'dark'}
      edges={['top', 'left', 'right']}
    >
      <ScrollView
        style={[styles.container, isFundi && styles.containerFundi]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ProfileSkeleton variant={isFundi ? 'fundi' : 'dark'} />
        ) : (
          <>
            <View style={styles.hero}>
              {coverPhotoUri ? (
                <Image
                  source={{ uri: coverPhotoUri }}
                  style={styles.heroImage}
                  resizeMode="cover"
                />
              ) : null}
              <LinearGradient
                colors={
                  coverPhotoUri
                    ? ['rgba(0,0,0,0.15)', '#1A1A1A']
                    : ['#3A2A0F', '#1A1A1A']
                }
                style={styles.heroGradient}
              >
                <View style={styles.heroGlow} />
                <View style={styles.heroGlowSm} />
                <Text style={styles.heroTitle}>{t('My Profile')}</Text>
                <Text style={styles.heroSub}>
                  {isFundi ? t('Fundi account') : t('Client account')}
                </Text>
              </LinearGradient>
              <TouchableOpacity
                style={styles.settingsBtn}
                onPress={() => onNavigate?.('settings')}
                activeOpacity={0.8}
              >
                <Ionicons name="settings-outline" size={18} color={theme.colors.white} />
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <View style={styles.avatarWrap}>
                <LinearGradient
                  colors={[theme.colors.accentLight, theme.colors.accentDark]}
                  style={styles.avatarRing}
                >
                  <View style={styles.avatar}>
                    {profilePhotoUri ? (
                      <Image source={{ uri: profilePhotoUri }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarText}>{initials(displayName)}</Text>
                    )}
                  </View>
                </LinearGradient>
                <TouchableOpacity
                  style={[styles.avatarEditBtn, isFundi && styles.avatarEditBtnFundi]}
                  onPress={() => onNavigate?.('edit')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="pencil" size={14} color={theme.colors.textDark} />
                </TouchableOpacity>
              </View>

              <View style={styles.identity}>
                <Text style={[styles.name, isFundi && styles.nameFundi]}>{displayName}</Text>
                <Text style={[styles.sub, isFundi && styles.subFundi]}>{email || t('No email added')}</Text>
                {isFundi ? (
                <View style={styles.metaRow}>
                  <Text style={[styles.trade, isFundi && styles.tradeFundi]} numberOfLines={1}>{trade}</Text>
                  <VerificationChip
                    status={verificationStatus}
                    light={isFundi}
                    onPress={
                      verificationStatus === 'verified'
                        ? undefined
                        : () => onNavigate?.('verification')
                    }
                  />
                </View>
              ) : null}
            </View>

              {isFundi ? (
                <VerifyPromptCard
                  status={verificationStatus}
                  notes={fundiProfile.verificationNotes}
                  light={isFundi}
                  onPress={() => onNavigate?.('verification')}
                />
              ) : null}

              {isFundi ? (
                <View style={[styles.statsRow, isFundi && styles.statsRowFundi]}>
                  <Stat value={rating ? rating.toFixed(1) : '—'} label={t('Rating')} star light={isFundi} />
                  <View style={[styles.statDivider, isFundi && styles.statDividerFundi]} />
                  <Stat value={completedJobs} label={t('Jobs Done')} light={isFundi} />
                  <View style={[styles.statDivider, isFundi && styles.statDividerFundi]} />
                  <Stat value={yearsExperience} label={t('Years')} light={isFundi} />
                </View>
              ) : null}

              {isFundi && skills.length > 0 ? (
                <View style={[styles.skillsCard, isFundi && styles.skillsCardFundi]}>
                  <Text style={[styles.skillsTitle, isFundi && styles.skillsTitleFundi]}>{t('Skills')}</Text>
                  <View style={styles.skillRow}>
                    {skills.map((s) => (
                      <View key={s} style={[styles.skillChip, isFundi && styles.skillChipFundi]}>
                        <Text style={[styles.skillText, isFundi && styles.skillTextFundi]}>{s}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={[styles.menuCard, isFundi && styles.menuCardFundi]}>
                <Text style={[styles.menuHeader, isFundi && styles.menuHeaderFundi]}>{t('Quick Actions')}</Text>
                <View style={styles.quickGrid}>
                  {accountItems.map((item) => (
                    <QuickActionTile key={item.key} item={item} onPress={handleMenu} light={isFundi} />
                  ))}
                </View>
              </View>

              <View style={[styles.menuCard, isFundi && styles.menuCardFundi]}>
                <Text style={[styles.menuHeader, isFundi && styles.menuHeaderFundi]}>{t('General')}</Text>
                {generalItems.map((item, i) => (
                  <MenuRow
                    key={item.key}
                    item={item}
                    onPress={handleMenu}
                    isLast={i === generalItems.length - 1}
                    light={isFundi}
                  />
                ))}
              </View>

              <TouchableOpacity
                style={styles.logoutRow}
                activeOpacity={0.8}
                onPress={() => {
                  Alert.alert(t('Logout'), t('Are you sure you want to logout?'), [
                    { text: t('Cancel'), style: 'cancel' },
                    { text: t('Logout'), style: 'destructive', onPress: () => onLogout?.() },
                  ]);
                }}
              >
                <Ionicons name="log-out-outline" size={18} color={theme.colors.red} />
                <Text style={styles.logoutText}>{t('Logout')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

function MenuRow({ item, onPress, isLast, light }) {
  const { t } = useLanguage();
  return (
    <TouchableOpacity
      style={[styles.menuRow, light && styles.menuRowFundi, isLast && styles.menuRowLast]}
      activeOpacity={0.7}
      onPress={() => onPress(item.key)}
    >
      <View style={styles.menuLeft}>
        <View style={styles.menuIconWrap}>
          <Ionicons name={item.icon} size={18} color={theme.colors.accent} />
        </View>
        <Text style={[styles.menuText, light && styles.menuTextFundi]}>{t(item.label)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={light ? fc.textMuted : theme.colors.mutedDark} />
    </TouchableOpacity>
  );
}

function QuickActionTile({ item, onPress, light }) {
  const { t } = useLanguage();
  return (
    <TouchableOpacity
      style={[styles.tile, light && styles.tileFundi]}
      activeOpacity={0.7}
      onPress={() => onPress(item.key)}
    >
      <View style={styles.tileIconWrap}>
        <Ionicons name={item.icon} size={22} color={theme.colors.accent} />
      </View>
      <Text style={[styles.tileLabel, light && styles.tileLabelFundi]} numberOfLines={2}>
        {t(item.label)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.black },
  container: { flex: 1 },
  scrollContent: { paddingBottom: 16 },

  hero: {
    height: 148,
    position: 'relative',
    overflow: 'hidden',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    backgroundColor: '#1A1A1A',
  },
  heroGradient: {
    flex: 1,
    padding: 20,
    paddingBottom: 62,
    justifyContent: 'flex-end',
  },
  heroTitle: {
    color: theme.colors.white,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  heroGlow: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,184,0,0.18)',
  },
  heroGlowSm: {
    position: 'absolute',
    top: 16,
    right: 70,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,184,0,0.12)',
  },
  settingsBtn: {
    position: 'absolute',
    top: 14,
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },

  content: { paddingHorizontal: 16 },

  avatarWrap: {
    marginTop: -48,
    width: 96,
    alignSelf: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    padding: 3,
    ...theme.elevation.md,
  },
  avatar: {
    flex: 1,
    borderRadius: 45,
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  avatarText: { color: theme.colors.white, fontWeight: '900', fontSize: 30 },
  avatarEditBtn: {
    position: 'absolute',
    right: -6,
    bottom: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.accent,
    borderWidth: 2.5,
    borderColor: theme.colors.black,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.elevation.sm,
  },

  identity: { alignItems: 'center', marginTop: 12 },
  name: { color: theme.colors.white, fontWeight: '900', fontSize: 22 },
  sub: { color: theme.colors.muted, marginTop: 4, fontSize: 13, paddingBottom: 6 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  trade: {
    color: theme.colors.accent,
    fontWeight: '700',
    fontSize: 12,
    flexShrink: 1,
  },

  verifyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  verifyChipText: { fontSize: 11, fontWeight: '800' },

  verifyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.input,
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.25)',
    borderRadius: 16,
    padding: 14,
    marginTop: 18,
  },
  verifyCardRejected: {
    borderColor: 'rgba(239,68,68,0.35)',
  },
  verifyCardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,184,0,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyCardBody: { flex: 1, gap: 3 },
  verifyCardTitle: { color: theme.colors.white, fontWeight: '800', fontSize: 14 },
  verifyCardText: { color: theme.colors.muted, fontSize: 12, lineHeight: 16 },
  verifyCardBtn: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  verifyCardBtnText: { color: theme.colors.textDark, fontWeight: '900', fontSize: 12 },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.panel,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 18,
    paddingVertical: 14,
    marginTop: 18,
    marginBottom: 16,
    ...theme.elevation.sm,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: theme.colors.white, fontWeight: '900', fontSize: 18 },
  statStar: { color: theme.colors.accent, fontSize: 13 },
  statLabel: { color: theme.colors.muted, fontSize: 11, fontWeight: '600', marginTop: 3 },
  statDivider: { width: 1, height: 28, backgroundColor: theme.colors.border },

  skillsCard: {
    backgroundColor: theme.colors.input,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  skillsTitle: { color: theme.colors.white, fontWeight: '800', marginBottom: 10 },
  skillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillChip: {
    backgroundColor: 'rgba(255,184,0,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  skillText: { color: theme.colors.accent, fontWeight: '700', fontSize: 12 },

  menuCard: {
    backgroundColor: theme.colors.panel,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 18,
    overflow: 'hidden',
    paddingTop: 6,
    marginBottom: 16,
    ...theme.elevation.sm,
  },
  menuHeader: {
    color: theme.colors.mutedDark,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  tile: {
    width: '31%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.input,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 6,
  },
  tileIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,184,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileLabel: {
    color: theme.colors.white,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 14,
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  menuRowLast: { borderBottomWidth: 0 },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(255,184,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuText: { color: theme.colors.white, fontWeight: '700', fontSize: 14 },

  logoutRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 16,
    padding: 14,
  },
  logoutText: { color: theme.colors.red, fontWeight: '900', fontSize: 14 },

  safeFundi: { backgroundColor: fc.page },
  containerFundi: { backgroundColor: fc.page },
  avatarEditBtnFundi: { borderColor: fc.card },
  nameFundi: { color: fc.text },
  subFundi: { color: fc.textMuted },
  tradeFundi: { color: fc.accentDark },
  verifyCardFundi: {
    backgroundColor: fc.card,
    borderColor: 'rgba(255,184,0,0.4)',
    ...fundiCardShadow,
  },
  verifyCardRejectedFundi: { borderColor: 'rgba(239,68,68,0.35)' },
  verifyCardTitleFundi: { color: fc.text },
  verifyCardTextFundi: { color: fc.textMuted },
  statsRowFundi: {
    backgroundColor: fc.card,
    borderColor: fc.border,
    ...fundiCardShadow,
  },
  statValueFundi: { color: fc.text },
  statLabelFundi: { color: fc.textMuted },
  statDividerFundi: { backgroundColor: fc.border },
  skillsCardFundi: {
    backgroundColor: fc.card,
    borderColor: fc.border,
    ...fundiCardShadow,
  },
  skillsTitleFundi: { color: fc.text },
  skillChipFundi: {
    backgroundColor: 'rgba(255,184,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.25)',
  },
  skillTextFundi: { color: fc.accentDark },
  menuCardFundi: {
    backgroundColor: fc.card,
    borderColor: fc.border,
    ...fundiCardShadow,
  },
  menuHeaderFundi: { color: fc.textMuted },
  tileFundi: {
    backgroundColor: fc.page,
    borderColor: fc.border,
  },
  tileLabelFundi: { color: fc.text },
  menuRowFundi: { borderBottomColor: fc.border },
  menuTextFundi: { color: fc.text },
});
