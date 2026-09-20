import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../theme';
import ScreenWrapper from '../components/ScreenWrapper';
import { updateProfile } from '../../services/usersApi';
import { useLanguage } from '../i18n/LanguageContext';

const SKILL_OPTIONS = ['plumbing', 'electrical', 'carpentry', 'masonry', 'painting', 'cleaning'];

const C = {
  page: theme.colors.bgLight,
  card: '#FFFFFF',
  border: '#E4E4E0',
  dashboard: '#1A1A1A',
  text: '#1A1A1A',
  muted: '#6B6B68',
  amber: '#FAEEDA',
  amberDark: '#854F0B',
  blue: '#E6F1FB',
  blueDark: '#185FA5',
  pillGray: '#EDEDEA',
  dashed: '#C9C9C4',
};

export default function FundiProfileSetupScreen({ onBack, onComplete, authToken }) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [skills, setSkills] = useState([]);
  const [customSkill, setCustomSkill] = useState('');
  const [customSkillFocused, setCustomSkillFocused] = useState(false);
  const [experience, setExperience] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleSkill = (skill) => {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const addCustomSkill = () => {
    const value = customSkill.trim().replace(/\s+/g, ' ');
    if (!value) return;
    setSkills((prev) => {
      const normalized = value.toLowerCase();
      const exists = prev.some(
        (s) => s.toLowerCase() === normalized || SKILL_OPTIONS.includes(normalized)
      );
      if (exists) return prev;
      return [...prev, value];
    });
    setCustomSkill('');
  };

  const canAddCustom = customSkill.trim().length > 0;

  const allSkillChips = [
    ...SKILL_OPTIONS,
    ...skills.filter((s) => !SKILL_OPTIONS.includes(s.toLowerCase())),
  ];

  const handleSave = async () => {
    if (skills.length === 0) {
      Alert.alert(t('Skills required'), t('Select at least one skill.'));
      return;
    }
    setLoading(true);
    try {
      await updateProfile({
        skills,
        experience: Number(experience) || 0,
        bio,
        onboardingComplete: true,
      });
      onComplete?.();
    } catch (error) {
      Alert.alert(t('Could not save profile'), error?.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper
      variant="fundi"
      edges={['top', 'left', 'right']}
      statusStripColor={theme.colors.black}
    >
      <View style={{ flex: 1 }}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={onBack}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={18} color={C.card} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('Set up your Fundi profile')}</Text>
            <View style={styles.headerSpacer} />
          </View>
          <View style={styles.headerDivider} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {/* Hero */}
          <View style={styles.heroCard}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="construct-outline" size={28} color={C.amberDark} />
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>{t('Almost there')}</Text>
            </View>
            <Text style={styles.heroText}>
              {t('Tell clients what you do best. You can update this later.')}
            </Text>
          </View>

          {/* Skills */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('Your skills')}</Text>
            <View style={styles.card}>
              <View style={styles.skillRow}>
                {allSkillChips.map((s) => {
                  const on = skills.some((x) => x.toLowerCase() === s.toLowerCase());
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => toggleSkill(s)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.cardDivider} />

              <Text style={styles.addLabel}>
                <Ionicons name="add-circle-outline" size={16} color={C.amberDark} />
                {'  '}
                {t('Add a skill not listed above')}
              </Text>
              <View style={[styles.customSkillRow, customSkillFocused && styles.customSkillRowFocused]}>
                <TextInput
                  style={styles.customSkillInput}
                  value={customSkill}
                  onChangeText={setCustomSkill}
                  onFocus={() => setCustomSkillFocused(true)}
                  onBlur={() => setCustomSkillFocused(false)}
                  placeholder={t('e.g. welding, tiling...')}
                  placeholderTextColor={C.muted}
                  onSubmitEditing={addCustomSkill}
                  returnKeyType="done"
                  autoCorrect={false}
                  maxLength={40}
                />
                <TouchableOpacity
                  style={[styles.addBtn, !canAddCustom && styles.addBtnDisabled]}
                  onPress={addCustomSkill}
                  disabled={!canAddCustom}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={16} color={C.amberDark} />
                  <Text style={styles.addBtnText}>{t('Add')}</Text>
                </TouchableOpacity>
              </View>
              {skills.some((s) => !SKILL_OPTIONS.includes(s.toLowerCase())) && (
                <Text style={styles.customHint}>
                  {t('Custom skills show on your public profile so clients can find you.')}
                </Text>
              )}
            </View>
          </View>

          {/* Experience */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('Years of experience')}</Text>
            <TextInput
              style={styles.input}
              value={experience}
              onChangeText={setExperience}
              keyboardType="number-pad"
              placeholder={t('e.g. 5')}
              placeholderTextColor={C.muted}
            />
          </View>

          {/* Bio */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('Short bio (optional)')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              multiline
              placeholder={t('Describe your expertise...')}
              placeholderTextColor={C.muted}
            />
          </View>

          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color={C.card} size="small" />
            ) : (
              <Text style={styles.submitText}>{t('Continue to verification')}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={17} color={C.blueDark} />
            <Text style={styles.infoText}>
              {t('You can update your profile anytime from your profile page.')}
            </Text>
          </View>
        </ScrollView>
        <View style={{ height: insets.bottom, backgroundColor: theme.colors.black }} />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: C.dashboard },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { width: 34, height: 34 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: C.card,
    fontSize: 18,
    fontWeight: '500',
  },
  headerDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },

  scroll: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 36,
  },

  heroCard: {
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  heroIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: C.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPill: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: C.amber,
  },
  heroPillText: { fontSize: 12, fontWeight: '600', color: C.amberDark, letterSpacing: 0.2 },
  heroText: {
    marginTop: 10,
    color: C.muted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 6,
  },

  section: { marginTop: 24 },
  sectionTitle: { color: C.text, fontSize: 15, fontWeight: '500' },

  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginTop: 10,
  },
  skillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: C.page,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipOn: { backgroundColor: C.amber, borderColor: C.amber },
  chipText: { color: C.muted, fontWeight: '700', fontSize: 13 },
  chipTextOn: { color: C.amberDark },
  cardDivider: {
    height: 1,
    backgroundColor: C.border,
    marginTop: 16,
    marginBottom: 14,
  },
  addLabel: {
    color: C.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  customSkillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.page,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingLeft: 14,
    paddingVertical: 4,
  },
  customSkillRowFocused: { borderColor: C.amberDark },
  customSkillInput: {
    flex: 1,
    paddingVertical: 12,
    color: C.text,
    fontSize: 15,
  },
  addBtn: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: C.amber,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginRight: 4,
  },
  addBtnDisabled: {
    backgroundColor: C.pillGray,
    opacity: 0.7,
  },
  addBtnText: { color: C.amberDark, fontWeight: '800', fontSize: 13 },
  customHint: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
  },

  input: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: C.text,
    fontSize: 15,
    marginTop: 10,
  },
  textArea: { minHeight: 110, textAlignVertical: 'top' },

  submitBtn: {
    height: 48,
    borderRadius: theme.buttons.radius.lg,
    backgroundColor: C.dashboard,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  submitText: { color: C.card, fontSize: 15, fontWeight: '700' },

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.blue,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  infoText: { color: C.muted, fontSize: 13, lineHeight: 18, flex: 1, marginLeft: 8 },
});