import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { fc, fundiCardShadow } from '../fundiTheme';
import ScreenWrapper from '../components/ScreenWrapper';
import FundiThemedScreen from '../components/FundiThemedScreen';
import { useLanguage } from '../i18n/LanguageContext';

export default function HelpSupportScreen({ onNavigate, userRole = 'customer' }) {
  const isFundi = userRole === 'fundi';
  const { t } = useLanguage();
  const faqs = [
    t('How do I book a service?'),
    t('How do I cancel a booking?'),
    t('Payment methods accepted?'),
    t('How to rate an artisan?'),
  ];

  const content = (
    <ScrollView contentContainerStyle={styles.container}>
      {!isFundi ? (
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => onNavigate?.('profile')} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={20} color={theme.colors.white} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('Help & Support')}</Text>
          <View style={{ width: 40 }} />
        </View>
      ) : null}

      <View style={[styles.searchRow, isFundi && styles.fundiInputCard]}>
        <Ionicons name="search-outline" size={18} color={isFundi ? fc.textMuted : theme.colors.muted} />
        <TextInput
          placeholder={t('Search for help...')}
          placeholderTextColor={isFundi ? fc.textSubtle : theme.colors.mutedDark}
          style={[styles.searchInput, isFundi && styles.fundiText]}
        />
      </View>

      <Text style={[styles.sectionLabel, isFundi && styles.fundiSection]}>{t('Quick Actions')}</Text>
      <View style={styles.quickRow}>
        <TouchableOpacity style={[styles.quickCard, isFundi && styles.fundiCard]}><Ionicons name="flag-outline" size={20} color={theme.colors.accent} /><Text style={[styles.quickText, isFundi && styles.fundiText]}>{t('Report Issue')}</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.quickCard, isFundi && styles.fundiCard]}><Ionicons name="chatbubbles-outline" size={20} color={theme.colors.accent} /><Text style={[styles.quickText, isFundi && styles.fundiText]}>{t('Chat Support')}</Text></TouchableOpacity>
      </View>

      <Text style={[styles.sectionLabel, isFundi && styles.fundiSection]}>{t('Frequently Asked')}</Text>
      <View style={[styles.card, isFundi && styles.fundiCard]}>
        {faqs.map((q) => (
          <TouchableOpacity key={q} style={[styles.faqRow, isFundi && styles.fundiRow]}>
            <Text style={[styles.faqText, isFundi && styles.fundiText]}>{q}</Text>
            <Ionicons name="chevron-forward" size={16} color={isFundi ? fc.textSubtle : theme.colors.mutedDark} />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.sectionLabel, isFundi && styles.fundiSection]}>{t('Contact Us')}</Text>
      <View style={[styles.card, isFundi && styles.fundiCard]}>
        <TouchableOpacity style={[styles.contactRow, isFundi && styles.fundiRow]}>
          <View style={styles.contactLeft}>
            <Ionicons name="mail-outline" size={16} color={theme.colors.accent} />
            <Text style={[styles.contactText, isFundi && styles.fundiText]}>{t('Email Support')}</Text>
          </View>
          <Text style={[styles.contactSub, isFundi && styles.fundiSub]}>support@ufundi.com</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.contactRow, isFundi && styles.fundiRow]}>
          <View style={styles.contactLeft}>
            <Ionicons name="call-outline" size={16} color={theme.colors.accent} />
            <Text style={[styles.contactText, isFundi && styles.fundiText]}>{t('Call Us')}</Text>
          </View>
          <Text style={[styles.contactSub, isFundi && styles.fundiSub]}>+256 700 123 456</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  if (isFundi) {
    return (
      <FundiThemedScreen title={t('Help & Support')} onBack={() => onNavigate?.('profile')}>
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

  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.input, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, paddingHorizontal: 14, height: 48, marginBottom: 16, gap: 10 },
  searchInput: { color: theme.colors.white, flex: 1, fontSize: 14 },

  sectionLabel: { color: theme.colors.mutedDark, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8 },
  quickRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  quickCard: { flex: 1, backgroundColor: theme.colors.panel, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, padding: 16, alignItems: 'center', gap: 8, ...theme.elevation.sm },
  quickText: { color: theme.colors.white, fontWeight: '800', fontSize: 12 },

  card: { backgroundColor: theme.colors.panel, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, marginBottom: 16, ...theme.elevation.sm },
  faqRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  faqText: { color: theme.colors.white, fontSize: 14 },

  contactRow: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  contactLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contactText: { color: theme.colors.white, fontWeight: '800', fontSize: 14 },
  contactSub: { color: theme.colors.mutedDark, fontSize: 12, marginTop: 4, marginLeft: 24 },

  fundiText: { color: fc.text },
  fundiSub: { color: fc.textMuted },
  fundiSection: { color: fc.textMuted },
  fundiInputCard: { backgroundColor: fc.card, borderColor: fc.border, ...fundiCardShadow },
  fundiCard: { backgroundColor: fc.card, borderColor: fc.border, ...fundiCardShadow },
  fundiRow: { borderBottomColor: fc.border },
});
