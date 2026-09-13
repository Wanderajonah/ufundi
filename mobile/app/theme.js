const colors = {
  black: '#000000',
  bg: '#000000',
  bgDark: '#000000',
  panel: '#1A1A1A',
  input: '#1F1F1F',
  card: '#1A1A1A',
  surface: '#111111',
  accent: '#FFB800',
  accentLight: '#FFD84D',
  accentDark: '#E5A600',
  accentDim: '#3A2A0F',
  white: '#FFFFFF',
  muted: '#9CA3AF',
  mutedDark: '#6B7280',
  textDark: '#0B0B0B',
  green: '#22C55E',
  red: '#EF4444',
  blue: '#3B82F6',
  border: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(255,255,255,0.12)',
  overlay: 'rgba(0,0,0,0.6)',
  glass: 'rgba(255,255,255,0.04)',
  mapGrid: '#1a1a1a',
  bgLight: '#F0F2F5',
  cardLight: '#FFFFFF',
  textMuted: '#6B7280',
  textSubtle: '#9CA3AF',
  shadow: 'rgba(0,0,0,0.08)',
};

const typography = {
  h1: 28,
  h2: 22,
  h3: 20,
  body: 14,
  small: 12,
  caps: 11,
};

const spacing = { xs: 6, sm: 12, md: 18, lg: 24, xl: 32, xxl: 48 };

const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 28,
};

const elevation = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
};

/* Buttons — single source of truth for every tappable control in the app.
   - height: `lg` is the standard full-width CTA, `md` for inline actions,
     `sm` for chips/small actions.
   - variant fills map 1:1 to a Button component's `variant` prop. */
const buttons = {
  height: { sm: 40, md: 46, lg: 54 },
  radius: { sm: 10, md: 14, lg: 16 },
  fontSize: { sm: 12, md: 14, lg: 16 },
  iconBtn: { size: 40, radius: 12 },
  variants: {
    primary: {
      backgroundColor: colors.accent,
      borderColor: 'transparent',
      text: colors.textDark,
      pressed: '#F0AD00',
    },
    secondary: {
      backgroundColor: colors.input,
      borderColor: colors.border,
      text: colors.white,
      pressed: '#262626',
    },
    outline: {
      backgroundColor: 'transparent',
      borderColor: colors.accent,
      text: colors.accent,
      pressed: 'rgba(255,184,0,0.08)',
    },
    ghost: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      text: colors.muted,
      pressed: 'rgba(255,255,255,0.05)',
    },
    destructive: {
      backgroundColor: 'rgba(239,68,68,0.12)',
      borderColor: 'rgba(239,68,68,0.35)',
      text: colors.red,
      pressed: 'rgba(239,68,68,0.22)',
    },
    google: {
      backgroundColor: colors.white,
      borderColor: 'rgba(0,0,0,0.08)',
      text: '#3C4043',
      pressed: '#F1F3F4',
    },
  },
};

export default { colors, typography, spacing, radius, elevation, buttons };
