import { StyleSheet } from 'react-native';
import theme from './theme';

/** White / black / gold palette for fundi-side screens only. */
export const fc = {
  page: theme.colors.bgLight,
  header: theme.colors.black,
  card: theme.colors.cardLight,
  text: theme.colors.textDark,
  textMuted: theme.colors.textMuted,
  textSubtle: theme.colors.textSubtle,
  accent: theme.colors.accent,
  accentDark: theme.colors.accentDark,
  white: theme.colors.white,
  green: theme.colors.green,
  red: theme.colors.red,
  border: 'rgba(0,0,0,0.06)',
};

export const fundiCardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
};

export const fundiStyles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: fc.page,
  },
  header: {
    backgroundColor: fc.header,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 20,
  },
  headerTitle: {
    color: fc.white,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    marginTop: 4,
    fontWeight: '600',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    backgroundColor: fc.page,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: fc.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    ...fundiCardShadow,
  },
  sectionTitle: {
    color: fc.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: fc.card,
    borderWidth: 1,
    borderColor: fc.border,
  },
  tabActive: {
    backgroundColor: fc.accent,
    borderColor: fc.accent,
  },
  tabText: {
    color: fc.textMuted,
    fontWeight: '700',
    fontSize: 11,
  },
  tabTextActive: {
    color: fc.text,
    fontWeight: '800',
  },
  name: {
    color: fc.text,
    fontWeight: '800',
    fontSize: 15,
  },
  meta: {
    color: fc.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  amount: {
    color: fc.accentDark,
    fontWeight: '800',
    fontSize: 14,
    marginTop: 8,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,184,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: fc.accentDark,
    fontWeight: '900',
  },
  menuCard: {
    backgroundColor: fc.card,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    ...fundiCardShadow,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: fc.border,
  },
  menuRowLast: {
    borderBottomWidth: 0,
  },
  menuLabel: {
    flex: 1,
    color: fc.text,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 12,
  },
  primaryBtn: {
    height: 50,
    borderRadius: 999,
    backgroundColor: fc.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: fc.text,
    fontSize: 14,
    fontWeight: '800',
  },
});

export default { fc, fundiCardShadow, fundiStyles };
