import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';

export default function FundiPageHeader({
  title,
  subtitle,
  onBack,
  rightIcon,
  onRightPress,
  rightElement,
}) {
  return (
    <View style={styles.header}>
      <View style={styles.row}>
        {onBack ? (
          <TouchableOpacity style={styles.action} onPress={onBack} activeOpacity={0.85}>
            <Ionicons name="arrow-back" size={20} color={theme.colors.white} />
          </TouchableOpacity>
        ) : (
          <View style={styles.actionSpacer} />
        )}
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {rightElement || (rightIcon ? (
          <TouchableOpacity style={styles.action} onPress={onRightPress} activeOpacity={0.85}>
            <Ionicons name={rightIcon} size={20} color={theme.colors.white} />
          </TouchableOpacity>
        ) : (
          <View style={styles.actionSpacer} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: theme.colors.black,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  action: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSpacer: {
    width: 40,
    height: 40,
  },
  titleWrap: {
    flex: 1,
    paddingHorizontal: 10,
  },
  title: {
    color: theme.colors.white,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
});
