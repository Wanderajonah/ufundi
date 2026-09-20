import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AppLogo from './AppLogo';
import theme from '../theme';

/**
 * Brand lockup used on every auth/onboarding screen:
 * the wrench logo with the "Ufundi" wordmark pulled up
 * into its bottom padding.
 */
export default function BrandLockup({ size = 150, wordmarkSize = 24 }) {
  return (
    <View style={styles.brand}>
      <AppLogo size={size} />
      <Text style={[styles.wordmark, { fontSize: wordmarkSize }]}>
        <Text style={styles.wordmarkAccent}>U</Text>fundi
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: {
    alignItems: 'center',
  },
  wordmark: {
    color: theme.colors.white,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: -35,
  },
  wordmarkAccent: {
    color: theme.colors.accent,
  },
});
