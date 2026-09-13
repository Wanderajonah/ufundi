import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import theme from '../theme';

/**
 * @param {import('react-native-safe-area-context').Edge[]} [edges]
 *   Default: all edges so every screen gets a dark bottom safe-area inset.
 *   Pass edges without 'bottom' (e.g. ['top','left','right']) on screens that
 *   sit above the bottom navigation bar, which applies its own inset.
 */
export default function ScreenWrapper({
  children,
  style,
  edges = ['top', 'left', 'right', 'bottom'],
  variant = 'dark',
  statusStripColor,
}) {
  const insets = useSafeAreaInsets();
  const bg =
    variant === 'fundi' ? theme.colors.bgLight : theme.colors.black;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }, style]} edges={edges}>
      {edges.includes('top') && insets.top > 0 ? (
        <View
          pointerEvents="none"
          style={[styles.statusStrip, { height: insets.top, backgroundColor: statusStripColor || theme.colors.black }]}
        />
      ) : null}
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  statusStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.black,
  },
});
