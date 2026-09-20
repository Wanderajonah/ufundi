import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
  TextInput,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import theme from '../theme';
import { fc } from '../fundiTheme';
import FundiThemedScreen from '../components/FundiThemedScreen';
import { getProfile, updateProfile, uploadPortfolioImages, deletePortfolioImage } from '../../services/usersApi';
import { compressImage, resolveMediaUrl } from '../../utils/image';
import { useLanguage } from '../i18n/LanguageContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GAP = 10;
const COLS = 3;
const PAGE_GUTTER = 16;
const CARD_PADDING = 16;
const IMG_SIZE = (SCREEN_WIDTH - PAGE_GUTTER * 2 - CARD_PADDING * 2 - GAP * (COLS - 1)) / COLS;

export default function SkillsPortfolioScreen({ onNavigate }) {
  const { t } = useLanguage();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [skillDraft, setSkillDraft] = useState('');
  const [savingSkills, setSavingSkills] = useState(false);

  const user = profile?.user || {};
  const fundiProfile = profile?.fundiProfile || {};
  const skills = fundiProfile.skills || [];
  const portfolioImages = fundiProfile.portfolioImages || [];

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data } = await getProfile();
      setProfile(data);
    } catch {
      Alert.alert(t('Error'), t('Could not load profile'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const addPhotos = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('Permission required'), t('Please allow access to your photos.'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.length) return;
      setUploading(true);
      try {
        const formData = new FormData();
        for (const [index, asset] of result.assets.entries()) {
          // Converts device-specific formats (such as HEIC) to a format the API
          // accepts and keeps portfolio uploads reasonably small.
          const uri = await compressImage(asset.uri);
          formData.append('images', {
            uri,
            type: 'image/jpeg',
            name: `portfolio-${Date.now()}-${index}.jpg`,
          });
        }
        await uploadPortfolioImages(formData);
        await loadProfile();
      } catch (error) {
        Alert.alert(t('Upload failed'), error?.response?.data?.message || t('Could not upload images.'));
      } finally {
        setUploading(false);
      }
    } catch {
      Alert.alert(t('Error'), t('Could not open photo gallery.'));
    }
  };

  const removePhoto = (imageUrl) => {
    Alert.alert(t('Remove photo'), t('Remove this photo from your portfolio?'), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Remove'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePortfolioImage(imageUrl);
            await loadProfile();
          } catch {
            Alert.alert(t('Error'), t('Could not remove photo.'));
          }
        },
      },
    ]);
  };

  const saveSkills = async (nextSkills) => {
    setSavingSkills(true);
    try {
      await updateProfile({ skills: nextSkills });
      setProfile((current) => ({
        ...current,
        fundiProfile: { ...(current?.fundiProfile || {}), skills: nextSkills },
      }));
    } catch (error) {
      Alert.alert(t('Error'), error?.response?.data?.message || t('Could not update skills.'));
    } finally {
      setSavingSkills(false);
    }
  };

  const addSkill = () => {
    const skill = skillDraft.trim();
    if (!skill || savingSkills) return;
    if (skills.some((item) => item.toLowerCase() === skill.toLowerCase())) {
      Alert.alert(t('Skill already added'));
      return;
    }
    setSkillDraft('');
    Keyboard.dismiss();
    saveSkills([...skills, skill]);
  };

  const removeSkill = (skill) => {
    if (!savingSkills) saveSkills(skills.filter((item) => item !== skill));
  };

  return (
    <FundiThemedScreen
      title={t('Skills & Portfolio')}
      onBack={() => onNavigate?.('profile')}
      scroll={false}
      contentStyle={{ paddingTop: 0 }}
    >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={theme.colors.accent} size="large" />
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>{t('Skills')}</Text>
                {savingSkills ? <ActivityIndicator color={theme.colors.accent} size="small" /> : null}
              </View>
              {skills.length > 0 ? (
                <View style={styles.skillsRow}>
                  {skills.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={styles.skillChip}
                      onPress={() => removeSkill(s)}
                      disabled={savingSkills}
                      accessibilityLabel={t('Remove skill')}
                    >
                      <Text style={styles.skillText}>{s}</Text>
                      <Ionicons name="close" size={15} color={theme.colors.accentDark} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>{t('No skills added yet')}</Text>
              )}
              <View style={styles.skillInputRow}>
                <TextInput
                  value={skillDraft}
                  onChangeText={setSkillDraft}
                  onSubmitEditing={addSkill}
                  placeholder={t('Add a skill')}
                  placeholderTextColor={fc.textSubtle}
                  style={styles.skillInput}
                  returnKeyType="done"
                  maxLength={40}
                  editable={!savingSkills}
                />
                <TouchableOpacity
                  style={[styles.addSkillButton, (!skillDraft.trim() || savingSkills) && styles.addSkillButtonDisabled]}
                  onPress={addSkill}
                  disabled={!skillDraft.trim() || savingSkills}
                  accessibilityLabel={t('Add skill')}
                >
                  <Ionicons name="add" size={22} color={theme.colors.textDark} />
                </TouchableOpacity>
              </View>
              <Text style={styles.skillHelp}>{t('Tap a skill to remove it.')}</Text>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>{t('Portfolio')}</Text>
              <Text style={styles.hint}>{t('Showcase your recent work to attract more clients')}</Text>

              <TouchableOpacity
                style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]}
                onPress={addPhotos}
                disabled={uploading}
                activeOpacity={0.85}
              >
                {uploading ? (
                  <ActivityIndicator color={theme.colors.textDark} size="small" />
                ) : (
                  <>
                    <Ionicons name="add-circle-outline" size={19} color={theme.colors.textDark} />
                    <Text style={styles.uploadText}>{t('Add Photos')}</Text>
                  </>
                )}
              </TouchableOpacity>

              {portfolioImages.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="images-outline" size={30} color={theme.colors.mutedDark} />
                  </View>
                  <Text style={styles.emptyTitle}>{t('No photos yet')}</Text>
                  <Text style={styles.emptyHint}>{t('Work samples will appear here once uploaded.')}</Text>
                </View>
              ) : (
                <View style={styles.grid}>
                  {portfolioImages.map((url, idx) => (
                    <TouchableOpacity
                      key={`${url}-${idx}`}
                      style={styles.imgWrap}
                      onPress={() => removePhoto(url)}
                      activeOpacity={0.7}
                    >
                      <Image source={{ uri: resolveMediaUrl(url) }} style={styles.img} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        )}
    </FundiThemedScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: PAGE_GUTTER, paddingTop: 20, paddingBottom: 32, gap: 14 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 200 },

  sectionCard: {
    backgroundColor: fc.card,
    borderRadius: 18,
    padding: CARD_PADDING,
    borderWidth: 1,
    borderColor: fc.border,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { color: fc.text, fontWeight: '800', fontSize: 16, marginBottom: 10 },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,184,0,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.2)',
  },
  skillText: { color: theme.colors.accentDark, fontWeight: '700', fontSize: 13 },
  emptyText: { color: fc.textMuted, fontSize: 13, fontStyle: 'italic' },
  skillInputRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  skillInput: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderColor: fc.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    color: fc.text,
    backgroundColor: 'rgba(107,114,128,0.05)',
    fontSize: 14,
  },
  addSkillButton: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSkillButtonDisabled: { opacity: 0.45 },
  skillHelp: { color: fc.textSubtle, fontSize: 11, marginTop: 8 },

  hint: { color: fc.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 16, marginTop: -3 },

  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.accent,
    height: 50,
    borderRadius: 14,
    marginBottom: 20,
  },
  uploadBtnDisabled: { opacity: 0.7 },
  uploadText: { color: theme.colors.textDark, fontWeight: '800', fontSize: 15 },

  emptyState: {
    minHeight: 174,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(107,114,128,0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(107,114,128,0.10)',
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(107,114,128,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: { color: fc.textMuted, fontSize: 14, fontWeight: '600' },
  emptyHint: { color: fc.textSubtle, fontSize: 12, textAlign: 'center', marginTop: 4 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  imgWrap: { width: IMG_SIZE, height: IMG_SIZE, borderRadius: 12, overflow: 'hidden' },
  img: { width: IMG_SIZE, height: IMG_SIZE },
});
