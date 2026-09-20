import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { useLanguage } from '../i18n/LanguageContext';

/**
 * Consistent top-of-screen treatment for every auth flow:
 * optional back button, then title + subtitle.
 */
export default function AuthHeader({
  onBack,
  title,
  subtitle,
  right,
}) {
  const { t } = useLanguage();
  return (
    <>
      <View style={styles.topRow}>
        {onBack ? (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={22} color={theme.colors.white} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
        {right ? <View style={styles.rightSlot}>{right}</View> : <View />}
      </View>

      {title ? <Text style={styles.title}>{t(title)}</Text> : null}
      {subtitle ? (
        <>
          <View style={styles.titleAccent} />
          <Text style={styles.subtitle}>{t(subtitle)}</Text>
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.input,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },

  title: {
    color: theme.colors.white,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'center',
    marginTop: 28,
  },
  titleAccent: {
    width: 26,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.accent,
    alignSelf: 'center',
    marginTop: 12,
  },
  subtitle: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: 0.2,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
  },
});
