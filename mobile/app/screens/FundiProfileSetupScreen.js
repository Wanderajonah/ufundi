import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScrollScreen from '../components/ScrollScreen';
import PrimaryButton from '../components/PrimaryButton';
import theme from '../theme';
import { fc, fundiCardShadow } from '../fundiTheme';
import { updateProfile } from '../../services/usersApi';
import { useLanguage } from '../i18n/LanguageContext';

const SKILL_OPTIONS = ['plumbing', 'electrical', 'carpentry', 'masonry', 'painting', 'cleaning'];

export default function FundiProfileSetupScreen({ onBack, onComplete, authToken }) {
  const { t } = useLanguage();
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
    <ScrollScreen keyboard contentStyle={styles.scroll} bottomPad={32} variant="fundi">
      <TouchableOpacity style={styles.backRow} onPress={onBack}>
        <Ionicons name="chevron-back" size={20} color={fc.text} />
      </TouchableOpacity>

      <Text style={styles.title}>{t('Set up your Fundi profile')}</Text>
      <Text style={styles.subtitle}>
        {t('Tell clients what you do best. You can update this later.')}
      </Text>

      <Text style={styles.label}>{t('Your skills')}</Text>
      <View style={styles.skillRow}>
        {allSkillChips.map((s) => {
          const on = skills.some((x) => x.toLowerCase() === s.toLowerCase());
          return (
            <TouchableOpacity
              key={s}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => toggleSkill(s)}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>
        <Ionicons name="add-circle-outline" size={16} color={theme.colors.accent} />
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
          placeholderTextColor={fc.textSubtle}
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
          <Ionicons name="add" size={18} color={theme.colors.textDark} />
          <Text style={styles.addBtnText}>{t('Add')}</Text>
        </TouchableOpacity>
      </View>
      {skills.some((s) => !SKILL_OPTIONS.includes(s.toLowerCase())) && (
        <Text style={styles.customHint}>
          {t('Custom skills show on your public profile so clients can find you.')}
        </Text>
      )}

      <Text style={styles.label}>{t('Years of experience')}</Text>
      <TextInput
        style={styles.input}
        value={experience}
        onChangeText={setExperience}
        keyboardType="number-pad"
        placeholder={t('e.g. 5')}
        placeholderTextColor={fc.textSubtle}
      />

      <Text style={styles.label}>{t('Short bio (optional)')}</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={bio}
        onChangeText={setBio}
        multiline
        placeholder={t('Describe your expertise...')}
        placeholderTextColor={fc.textSubtle}
      />

      <PrimaryButton onPress={handleSave} disabled={loading}>
        {loading ? t('Saving…') : t('Continue to dashboard ')}
      </PrimaryButton>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  backRow: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: fc.card,
    borderWidth: 1,
    borderColor: fc.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    ...fundiCardShadow,
  },
  title: { color: fc.text, fontSize: 26, fontWeight: '800', marginBottom: 8 },
  subtitle: {
    color: fc.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 32,
  },
  label: {
    color: fc.textMuted,
    fontSize: theme.typography.caps,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 12,
    marginTop: 24,
  },
  skillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  customSkillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    backgroundColor: fc.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: fc.border,
    paddingLeft: 16,
    paddingVertical: 4,
    ...fundiCardShadow,
  },
  customSkillRowFocused: {
    borderColor: theme.colors.accent,
  },
  customSkillInput: {
    flex: 1,
    paddingVertical: 12,
    color: fc.text,
    fontSize: 15,
  },
  addBtn: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: theme.colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginRight: 4,
  },
  addBtnDisabled: {
    backgroundColor: fc.border,
    opacity: 0.6,
  },
  addBtnText: {
    color: theme.colors.textDark,
    fontWeight: '800',
    fontSize: 14,
  },
  customHint: {
    color: fc.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 24,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: fc.card,
    borderWidth: 1,
    borderColor: fc.border,
  },
  chipOn: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  chipText: { color: fc.textMuted, fontWeight: '700', fontSize: 13 },
  chipTextOn: { color: theme.colors.textDark },
  input: {
    backgroundColor: fc.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: fc.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: fc.text,
    fontSize: 16,
    marginBottom: 8,
    ...fundiCardShadow,
  },
  textArea: { minHeight: 110, textAlignVertical: 'top', marginBottom: 16 },
});
