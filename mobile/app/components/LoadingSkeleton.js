import React from 'react';
import { View, StyleSheet } from 'react-native';
import theme from '../theme';
import { fundiCardShadow } from '../fundiTheme';

const skins = {
  dark: {
    card: theme.colors.input,
    block: 'rgba(255,255,255,0.07)',
    faint: 'rgba(255,255,255,0.04)',
    hero: '#242424',
    accentTint: 'rgba(255,184,0,0.18)',
  },
  fundi: {
    card: '#FFFFFF',
    block: '#E4E7EB',
    faint: '#EDF0F3',
    hero: '#332A1C',
    accentTint: 'rgba(255,184,0,0.24)',
  },
};

function Block({ width = '100%', height = 14, variant = 'dark', radius = 6, style }) {
  const s = skins[variant] || skins.dark;
  return <View style={[{ width, height, borderRadius: radius, backgroundColor: s.block }, style]} />;
}

function Avatar({ size = 44, variant = 'dark', radius, style }) {
  const s = skins[variant] || skins.dark;
  return (
    <View style={[{ width: size, height: size, borderRadius: radius ?? size / 2, backgroundColor: s.block }, style]} />
  );
}

export function SkeletonCard({ lines = 3, variant = 'dark', showMeta = true }) {
  return (
    <View style={[styles.card, { backgroundColor: skin(variant).card }, variant === 'fundi' && fundiCardShadow]}>
      <View style={styles.row}>
        <Avatar variant={variant} />
        <View style={{ flex: 1, gap: 8 }}>
          <Block width="55%" height={12} variant={variant} />
          <Block width="35%" height={10} variant={variant} />
        </View>
        {showMeta ? (
          <View style={styles.meta}>
            <Block width={48} height={20} radius={8} variant={variant} />
          </View>
        ) : null}
      </View>
      {Array.from({ length: lines }).map((_, i) => (
        <Block
          key={i}
          width={`${90 - i * 10}%`}
          height={10}
          variant={variant}
          style={{ marginTop: 10 }}
        />
      ))}
    </View>
  );
}

export function ProfileSkeleton({ variant = 'dark' }) {
  return (
    <View>
      <View style={[styles.hero, { backgroundColor: skin(variant).hero }]} />
      <View style={styles.pricture}>
        <Avatar size={92} variant={variant} />
      </View>
      <View style={styles.centerCol}>
        <Block width={140} height={16} variant={variant} />
        <Block width={180} height={11} variant={variant} style={{ marginTop: 8 }} />
      </View>
      <View style={[styles.statWrap, { backgroundColor: skin(variant).card }, variant === 'fundi' && fundiCardShadow]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.stat}>
            <Block width={42} height={14} variant={variant} />
            <Block width={54} height={9} variant={variant} style={{ marginTop: 6 }} />
          </View>
        ))}
      </View>
      <View style={[styles.verifyCard, { backgroundColor: skin(variant).card }, variant === 'fundi' && fundiCardShadow]}>
        <Avatar size={40} radius={12} variant={variant} />
        <View style={{ flex: 1, gap: 7 }}>
          <Block width="45%" height={12} variant={variant} />
          <Block width="85%" height={10} variant={variant} />
          <Block width="60%" height={10} variant={variant} />
        </View>
        <Block width={58} height={30} radius={10} variant={variant} />
      </View>
      {[0, 1].map((card) => (
        <View
          key={card}
          style={[styles.menuCard, { backgroundColor: skin(variant).card }, variant === 'fundi' && fundiCardShadow]}
        >
          <Block width="28%" height={9} variant={variant} style={{ marginLeft: 16, marginTop: 14 }} />
          {[0, 1, 2].slice(0, card === 0 ? 3 : 2).map((r) => (
            <View key={r} style={styles.menuRow}>
              <Avatar size={34} radius={11} variant={variant} />
              <Block width="38%" height={12} variant={variant} />
              <Avatar size={8} radius={4} variant={variant} />
            </View>
          ))}
        </View>
      ))}
      <Block width="70%" height={40} radius={14} variant={variant} style={styles.logoutBlock} />
    </View>
  );
}

export function WalletSkeleton({ variant = 'dark' }) {
  const isFundi = variant === 'fundi';
  return (
    <View>
      <View
        style={[
          styles.balanceCard,
          { backgroundColor: isFundi ? skin(variant).card : theme.colors.input },
          isFundi && fundiCardShadow,
        ]}
      >
        <Block width={90} height={10} variant={variant} />
        <Block width={150} height={26} variant={variant} style={{ marginTop: 14 }} />
        <Block width={80} height={10} variant={variant} style={{ marginTop: 14 }} />
      </View>
      <View style={styles.actionsRow}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[styles.actionTile, { backgroundColor: skin(variant).card }, isFundi && fundiCardShadow]}
          >
            <Avatar size={38} radius={12} variant={variant} />
            <Block width="60%" height={9} variant={variant} style={{ marginTop: 10 }} />
          </View>
        ))}
      </View>
      <Block width="34%" height={12} variant={variant} style={styles.sectionLabel} />
      <View style={styles.list}>
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} lines={i === 0 ? 2 : 1} variant={variant} />
        ))}
      </View>
    </View>
  );
}

export function FundiJobSkeleton({ variant = 'fundi' }) {
  return (
    <View style={[styles.card, { backgroundColor: skin(variant).card }, variant === 'fundi' && fundiCardShadow]}>
      <View style={styles.row}>
        <Avatar variant={variant} />
        <View style={{ flex: 1, gap: 8 }}>
          <Block width="55%" height={12} variant={variant} />
          <Block width="40%" height={10} variant={variant} />
        </View>
        <View style={styles.meta}>
          <Block width={48} height={20} radius={8} variant={variant} />
        </View>
      </View>
      <Block width="100%" height={10} variant={variant} style={{ marginTop: 12 }} />
      <Block width="72%" height={10} variant={variant} style={{ marginTop: 8 }} />
      <View style={styles.stepTrack}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[styles.seg, { backgroundColor: i === 0 ? skin(variant).block : skin(variant).faint }]}
          />
        ))}
      </View>
      <View style={[styles.actionSkel, { backgroundColor: skin(variant).accentTint }]}>
        <Block width="42%" height={12} variant="dark" />
      </View>
    </View>
  );
}

export default function LoadingSkeleton({ count = 3, variant = 'dark' }) {
  return (
    <View style={styles.wrap}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} variant={variant} />
      ))}
    </View>
  );
}

function skin(variant) {
  return skins[variant] || skins.dark;
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  card: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  meta: { paddingLeft: 6 },
  hero: { height: 148, width: '100%' },
  pricture: { marginTop: -44, alignSelf: 'center' },
  centerCol: { alignItems: 'center', marginTop: 12, gap: 2 },
  statWrap: {
    flexDirection: 'row',
    borderRadius: 18,
    paddingVertical: 18,
    marginTop: 18,
    marginBottom: 16,
    marginHorizontal: 16,
  },
  stat: { flex: 1, alignItems: 'center' },
  verifyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  menuCard: { borderRadius: 18, overflow: 'hidden', marginBottom: 16 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  logoutBlock: { alignSelf: 'center', marginTop: 4 },
  balanceCard: {
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
  },
  actionsRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 16 },
  actionTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
  },
  sectionLabel: { marginHorizontal: 16, marginTop: 20, marginBottom: 12 },
  list: { paddingHorizontal: 16 },
  stepTrack: { flexDirection: 'row', gap: 6, marginTop: 16 },
  seg: { flex: 1, height: 5, borderRadius: 3 },
  actionSkel: {
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
});