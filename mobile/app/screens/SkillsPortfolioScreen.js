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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import theme from '../theme';
import { fc } from '../fundiTheme';
import FundiThemedScreen from '../components/FundiThemedScreen';
import { getProfile, uploadPortfolioImages, deletePortfolioImage } from '../../services/usersApi';
import { resolveMediaUrl } from '../../utils/image';
import { useLanguage } from '../i18n/LanguageContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GAP = 8;
const COLS = 3;
const IMG_SIZE = (SCREEN_WIDTH - 40 - GAP * (COLS - 1)) / COLS;

export default function SkillsPortfolioScreen({ onNavigate }) {
  const { t } = useLanguage();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

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
        for (const asset of result.assets) {
          formData.append('images', {
            uri: asset.uri,
            type: asset.mimeType || 'image/jpeg',
            name: asset.fileName || `portfolio-${Date.now()}.jpg`,
          });
        }
        await uploadPortfolioImages(formData);
        await loadProfile();
      } catch {
        Alert.alert(t('Upload failed'), t('Could not upload images.'));
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
            <Text style={styles.sectionLabel}>{t('Skills')}</Text>
            {skills.length > 0 ? (
              <View style={styles.skillsRow}>
                {skills.map((s) => (
                  <View key={s} style={styles.skillChip}>
                    <Text style={styles.skillText}>{s}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>{t('No skills added yet')}</Text>
            )}

            <View style={styles.divider} />

            <Text style={styles.sectionLabel}>{t('Portfolio')}</Text>
            <Text style={styles.hint}>{t('Showcase your recent work to attract more clients')}</Text>

            <TouchableOpacity
              style={styles.uploadBtn}
              onPress={addPhotos}
              disabled={uploading}
              activeOpacity={0.85}
            >
              {uploading ? (
                <ActivityIndicator color={theme.colors.textDark} size="small" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={18} color={theme.colors.textDark} />
                  <Text style={styles.uploadText}>{t('Add Photos')}</Text>
                </>
              )}
            </TouchableOpacity>

            {portfolioImages.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="images-outline" size={40} color={theme.colors.mutedDark} />
                <Text style={styles.emptyTitle}>{t('No photos yet')}</Text>
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
          </ScrollView>
        )}
    </FundiThemedScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 24 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 200 },

  sectionLabel: { color: fc.text, fontWeight: '800', fontSize: 15, marginBottom: 10 },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillChip: {
    backgroundColor: 'rgba(255,184,0,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.2)',
  },
  skillText: { color: theme.colors.accentDark, fontWeight: '700', fontSize: 13 },
  emptyText: { color: fc.textMuted, fontSize: 13, fontStyle: 'italic' },

  divider: { height: 1, backgroundColor: fc.border, marginVertical: 20 },

  hint: { color: fc.textMuted, fontSize: 12, marginBottom: 14, marginTop: -4 },

  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.accent,
    paddingVertical: 13,
    borderRadius: 14,
    marginBottom: 16,
  },
  uploadText: { color: theme.colors.textDark, fontWeight: '800', fontSize: 15 },

  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  emptyTitle: { color: fc.textMuted, fontSize: 14, fontWeight: '600' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  imgWrap: { width: IMG_SIZE, height: IMG_SIZE, borderRadius: 12, overflow: 'hidden' },
  img: { width: IMG_SIZE, height: IMG_SIZE },
});
