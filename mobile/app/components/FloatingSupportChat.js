import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../theme';
import { SupportChat } from '../screens/ChatScreen';
import { useLanguage } from '../i18n/LanguageContext';

export default function FloatingSupportChat({ userId, onNavigate }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <>
      <TouchableOpacity
        style={[
          styles.fab,
          {
            right: 18,
            bottom: Math.max(insets.bottom, 10) + 86,
          },
        ]}
        activeOpacity={0.86}
        onPress={() => setOpen(true)}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color={theme.colors.black} />
      </TouchableOpacity>

      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalRoot}>
          <View style={[styles.header, { paddingTop: insets.top }]}>
            <View style={styles.headerLeft}>
              <Ionicons name="headset" size={20} color={theme.colors.accent} />
              <Text style={styles.title}>{t('Ufundi Support')}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setOpen(false)}>
              <Ionicons name="close" size={22} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
          <SupportChat userId={userId} onNavigate={onNavigate} />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    zIndex: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    ...theme.elevation.md,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: theme.colors.black,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.panel,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: theme.colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.glass,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
});
