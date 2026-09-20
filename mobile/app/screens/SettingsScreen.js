import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { fc, fundiCardShadow } from '../fundiTheme';
import ScreenWrapper from '../components/ScreenWrapper';
import FundiThemedScreen from '../components/FundiThemedScreen';
import { useLanguage } from '../i18n/LanguageContext';
import { LANGUAGES } from '../i18n/translations';

export default function SettingsScreen({ onNavigate, userRole = 'customer' }) {
  const isFundi = userRole === 'fundi';
  const { language, setLanguage, t } = useLanguage();
  const [langModal, setLangModal] = useState(false);

  const current = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  const handleSelectLanguage = async (code) => {
    setLangModal(false);
    await setLanguage(code);
    Alert.alert(t('Language'), t('Language setting saved'));
  };

  const content = (
    <>
      <ScrollView contentContainerStyle={[styles.container, isFundi && styles.containerFundi]}>
        {!isFundi ? (
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => onNavigate?.('profile')} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={20} color={theme.colors.white} />
            </TouchableOpacity>
            <Text style={styles.title}>{t('Settings')}</Text>
            <View style={{ width: 40 }} />
          </View>
        ) : null}

        <Text style={[styles.sectionLabel, isFundi && styles.sectionLabelFundi]}>{t('Notifications')}</Text>
        <View style={[styles.card, isFundi && styles.cardFundi]}>
          <View style={[styles.row, isFundi && styles.rowFundi]}><Text style={[styles.rowText, isFundi && styles.rowTextFundi]}>{t('Push Notifications')}</Text><Switch value trackColor={{ true: theme.colors.accent }} thumbColor={theme.colors.textDark} /></View>
          <View style={[styles.row, isFundi && styles.rowFundi]}><Text style={[styles.rowText, isFundi && styles.rowTextFundi]}>{t('Email Notifications')}</Text><Switch value={false} trackColor={{ true: theme.colors.accent }} thumbColor={theme.colors.textDark} /></View>
          <View style={[styles.row, isFundi && styles.rowFundi]}><Text style={[styles.rowText, isFundi && styles.rowTextFundi]}>{t('SMS Notifications')}</Text><Switch value trackColor={{ true: theme.colors.accent }} thumbColor={theme.colors.textDark} /></View>
        </View>

        <Text style={[styles.sectionLabel, isFundi && styles.sectionLabelFundi]}>{t('Privacy')}</Text>
        <View style={[styles.card, isFundi && styles.cardFundi]}>
          <View style={[styles.row, isFundi && styles.rowFundi]}><Text style={[styles.rowText, isFundi && styles.rowTextFundi]}>{t('Share Location')}</Text><Switch value trackColor={{ true: theme.colors.accent }} thumbColor={theme.colors.textDark} /></View>
          <TouchableOpacity style={[styles.row, isFundi && styles.rowFundi]}><Text style={[styles.rowText, isFundi && styles.rowTextFundi]}>{t('Profile Visibility')}</Text><Ionicons name="chevron-forward" size={16} color={isFundi ? fc.textMuted : theme.colors.mutedDark} /></TouchableOpacity>
        </View>

        <Text style={[styles.sectionLabel, isFundi && styles.sectionLabelFundi]}>{t('App Settings')}</Text>
        <View style={[styles.card, isFundi && styles.cardFundi]}>
          <TouchableOpacity style={[styles.row, isFundi && styles.rowFundi]} onPress={() => setLangModal(true)}>
            <Text style={[styles.rowText, isFundi && styles.rowTextFundi]}>{t('Language')}</Text>
            <View style={styles.valueRow}>
              <Text style={[styles.valueText, isFundi && styles.valueTextFundi]}>{current.native}</Text>
              <Ionicons name="chevron-forward" size={16} color={isFundi ? fc.textMuted : theme.colors.mutedDark} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.row, isFundi && styles.rowFundi]}><Text style={[styles.rowText, isFundi && styles.rowTextFundi]}>{t('Currency')}</Text><Text style={[styles.valueText, isFundi && styles.valueTextFundi]}>UGX</Text></TouchableOpacity>
          <View style={[styles.row, isFundi && styles.rowFundi]}><Text style={[styles.rowText, isFundi && styles.rowTextFundi]}>{t('Dark Mode')}</Text><Switch value trackColor={{ true: theme.colors.accent }} thumbColor={theme.colors.textDark} /></View>
        </View>

        <Text style={[styles.sectionLabel, isFundi && styles.sectionLabelFundi]}>{t('Legal')}</Text>
        <View style={[styles.card, isFundi && styles.cardFundi]}>
          <TouchableOpacity style={[styles.row, isFundi && styles.rowFundi]}><Text style={[styles.rowText, isFundi && styles.rowTextFundi]}>{t('Terms & Conditions')}</Text><Ionicons name="chevron-forward" size={16} color={isFundi ? fc.textMuted : theme.colors.mutedDark} /></TouchableOpacity>
          <TouchableOpacity style={[styles.row, isFundi && styles.rowFundi]}><Text style={[styles.rowText, isFundi && styles.rowTextFundi]}>{t('Privacy Policy')}</Text><Ionicons name="chevron-forward" size={16} color={isFundi ? fc.textMuted : theme.colors.mutedDark} /></TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={langModal} transparent animationType="fade" onRequestClose={() => setLangModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('Language')}</Text>
            {LANGUAGES.map((lang) => {
              const active = lang.code === language;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langRow, active && styles.langRowActive]}
                  onPress={() => handleSelectLanguage(lang.code)}
                >
                  <Text style={[styles.langLabel, active && styles.langLabelActive]}>{lang.native}</Text>
                  <Text style={styles.langSub}>{lang.label}</Text>
                  {active ? <Ionicons name="checkmark-circle" size={20} color={theme.colors.accent} /> : null}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setLangModal(false)}>
              <Text style={styles.modalCancelText}>{t('Cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );

  if (isFundi) {
    return (
      <FundiThemedScreen title={t('Settings')} onBack={() => onNavigate?.('profile')} scroll={false} contentStyle={{ paddingTop: 0 }}>
        {content}
      </FundiThemedScreen>
    );
  }

  return (
    <ScreenWrapper style={styles.safe}>
      {content}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.black },
  container: { paddingHorizontal: 16, paddingBottom: 60 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, marginBottom: 16 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.input, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  title: { color: theme.colors.white, fontWeight: '900', fontSize: 18 },

  sectionLabel: { color: theme.colors.mutedDark, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginTop: 10, marginBottom: 8 },
  card: { backgroundColor: theme.colors.panel, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 4, ...theme.elevation.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowText: { color: theme.colors.white, fontWeight: '700', fontSize: 14 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  valueText: { color: theme.colors.mutedDark, fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: theme.colors.panel, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 20, padding: 20 },
  modalTitle: { color: theme.colors.white, fontSize: 18, fontWeight: '800', marginBottom: 12 },
  langRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8 },
  langRowActive: { borderColor: theme.colors.accent },
  langLabel: { color: theme.colors.white, fontWeight: '800', fontSize: 15 },
  langLabelActive: { color: theme.colors.accent },
  langSub: { color: theme.colors.mutedDark, fontSize: 12, flex: 1, marginLeft: 8 },
  modalCancel: { marginTop: 8, alignItems: 'center', paddingVertical: 12 },
  modalCancelText: { color: theme.colors.muted, fontWeight: '700', fontSize: 14 },

  containerFundi: { paddingTop: 8 },
  sectionLabelFundi: { color: fc.textMuted },
  cardFundi: {
    backgroundColor: fc.card,
    borderColor: fc.border,
    ...fundiCardShadow,
  },
  rowFundi: { borderBottomColor: fc.border },
  rowTextFundi: { color: fc.text },
  valueTextFundi: { color: fc.textMuted },
});
