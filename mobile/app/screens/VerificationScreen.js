import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../theme';
import ScreenWrapper from '../components/ScreenWrapper';
import { getProfile, requestVerification } from '../../services/usersApi';
import { resolveMediaUrl } from '../../utils/image';
import { useLanguage } from '../i18n/LanguageContext';

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

const STATUS_MAP = {
  unverified: { label: 'Not verified', color: C.amberDark, bg: C.amber, icon: 'shield-checkmark-outline' },
  pending:    { label: 'Verification pending', color: '#B45309', bg: '#FDF0DF', icon: 'time-outline' },
  verified:   { label: 'Verified', color: '#177245', bg: '#E4F3E8', icon: 'shield-checkmark' },
  rejected:   { label: 'Rejected', color: '#B42318', bg: '#FBE8E6', icon: 'shield-outline' },
};

const MAX_DOCS = 5;

const EXT_TO_MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

const documentUpload = (asset) => {
  const name = asset.name || `verification-${Date.now()}.jpg`;
  const ext = String(name.split('.').pop() || '').toLowerCase();
  return {
    uri: asset.uri,
    name,
    type: asset.mimeType || EXT_TO_MIME[ext] || 'application/octet-stream',
  };
};

export default function VerificationScreen({ onNavigate, onBack }) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState([]);

  const fundiProfile = profile?.fundiProfile || {};
  const status = fundiProfile.verificationStatus || 'unverified';
  const statusInfo = STATUS_MAP[status] || STATUS_MAP.unverified;
  const docs = fundiProfile.verificationDocs || [];

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

  const pickDocuments = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      setSelectedDocs((prev) => {
        const existing = new Set(prev.map((d) => d.uri || d.name));
        const newDocs = result.assets.filter((d) => !existing.has(d.uri || d.name));
        return [...prev, ...newDocs].slice(0, MAX_DOCS);
      });
    } catch {
      Alert.alert(t('Error'), t('Could not pick documents.'));
    }
  };

  const removeDoc = (doc) => {
    setSelectedDocs((prev) => prev.filter((d) => (d.uri || d.name) !== (doc.uri || doc.name)));
  };

  const handleSubmit = async () => {
    if (selectedDocs.length === 0) {
      Alert.alert(t('Documents required'), t('Please upload at least one document (e.g., ID, business license).'));
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      for (const asset of selectedDocs) {
        formData.append('documents', documentUpload(asset));
      }
      const { data } = await requestVerification(formData);
      setProfile((prev) => ({ ...prev, fundiProfile: data.fundiProfile }));
      setSelectedDocs([]);
      Alert.alert(t('Submitted'), t('Your verification request has been submitted for review.'));
    } catch (e) {
      Alert.alert(t('Error'), e?.response?.data?.message || t('Could not submit request.'));
    } finally {
      setSubmitting(false);
    }
  };

  const statusSub =
    status === 'verified'
      ? t('Your identity has been verified. Clients can trust you with confidence.')
      : status === 'pending'
        ? t('Your documents are being reviewed. This usually takes 1-2 business days.')
        : status === 'rejected'
          ? fundiProfile.verificationNotes || t('Your verification was rejected. Please submit new documents.')
          : t('Verification is required before clients can see you, you appear on the map, or you can receive job requests.');

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
              onPress={() => (onBack ? onBack() : onNavigate?.('profile'))}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={18} color={C.card} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('Verification')}</Text>
            <View style={styles.headerSpacer} />
          </View>
          <View style={styles.headerDivider} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#854F0B" size="large" />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
          >
          {/* Status */}
          <View style={styles.statusCard}>
            <View style={[styles.statusIconWrap, { backgroundColor: statusInfo.bg }]}>
              <Ionicons name={statusInfo.icon} size={28} color={statusInfo.color} />
            </View>
            <View style={[styles.statusPill, { backgroundColor: statusInfo.bg }]}>
              <Text style={[styles.statusPillText, { color: statusInfo.color }]}>{t(statusInfo.label)}</Text>
            </View>
            <Text style={styles.statusSub}>{statusSub}</Text>
          </View>

          {/* Identity documents */}
          {(status === 'unverified' || status === 'rejected') && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('Identity documents')}</Text>
              <Text style={styles.sectionHint}>
                {t('Upload a photo or PDF of your national ID, business license, or any official document')}
              </Text>

              <TouchableOpacity style={styles.pickCard} onPress={pickDocuments} activeOpacity={0.85}>
                <View style={styles.pickIcon}>
                  <Ionicons name="cloud-upload-outline" size={24} color={C.blueDark} />
                </View>
                <View style={styles.pickTextWrap}>
                  <Text style={styles.pickTitle}>{t('Select images or PDF')}</Text>
                  <Text style={styles.pickSub}>{t('Up to {{max}} documents', { max: MAX_DOCS })}</Text>
                </View>
                <View style={styles.counterPill}>
                  <Text style={styles.counterText}>{selectedDocs.length}/{MAX_DOCS}</Text>
                </View>
              </TouchableOpacity>

              {selectedDocs.length > 0 && (
                <View style={styles.docsList}>
                  {selectedDocs.map((doc, idx) => {
                    const isPdf = doc.mimeType === 'application/pdf' || doc.name?.endsWith('.pdf');
                    return (
                      <View key={doc.uri || doc.name || idx} style={styles.docItem}>
                        {isPdf ? (
                          <View style={[styles.docThumb, styles.pdfIcon]}>
                            <Ionicons name="document-text" size={20} color="#854F0B" />
                          </View>
                        ) : (
                          <Image source={{ uri: doc.uri }} style={styles.docThumb} />
                        )}
                        <Text style={styles.docName} numberOfLines={1}>
                          {doc.name || t('Document {{num}}', { num: idx + 1 })}
                        </Text>
                        <TouchableOpacity
                          onPress={() => removeDoc(doc)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close-circle" size={22} color={theme.colors.red} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} activeOpacity={0.9}>
                {submitting ? (
                  <ActivityIndicator color={C.card} size="small" />
                ) : (
                  <Text style={styles.submitText}>{t('Submit for review')}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Submitted docs */}
          {status === 'pending' && docs.length > 0 && (
            <View style={[styles.section, { paddingTop: 0 }]}>
              <Text style={styles.sectionTitle}>{t('Submitted documents')}</Text>
              <View style={styles.submittedList}>
                {docs.map((url, idx) => (
                  <Image
                    key={`${url}-${idx}`}
                    source={{ uri: resolveMediaUrl(url) }}
                    style={styles.submittedDoc}
                    resizeMode="cover"
                  />
                ))}
              </View>
            </View>
          )}

          {/* Info banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={17} color={C.blueDark} />
            <Text style={styles.infoText}>
              {t('Only verified fundis are shown to clients and can access client jobs.')}
            </Text>
          </View>
        </ScrollView>
        )}
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

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  scroll: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 36,
  },

  statusCard: {
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  statusIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusPillText: { fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
  statusSub: {
    marginTop: 10,
    color: C.muted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 6,
  },

  section: { marginTop: 24 },
  sectionTitle: { color: C.text, fontSize: 15, fontWeight: '500' },
  sectionHint: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 14,
  },

  pickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: C.dashed,
    padding: 14,
  },
  pickIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: C.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickTextWrap: { flex: 1, marginLeft: 12 },
  pickTitle: { color: C.text, fontSize: 14, fontWeight: '500' },
  pickSub: { color: C.muted, fontSize: 12, marginTop: 2 },
  counterPill: {
    backgroundColor: C.pillGray,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  counterText: { color: C.muted, fontSize: 12, fontWeight: '600' },

  docsList: { gap: 10, marginTop: 14 },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
  },
  docThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: C.page,
    marginRight: 12,
  },
  pdfIcon: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.amber },
  docName: { flex: 1, color: C.text, fontSize: 13, fontWeight: '500' },

  submitBtn: {
    height: 48,
    borderRadius: theme.buttons.radius.lg,
    backgroundColor: C.dashboard,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  submitText: { color: C.card, fontSize: 15, fontWeight: '700' },

  submittedList: { gap: 12, marginTop: 12 },
  submittedDoc: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    backgroundColor: C.page,
  },

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.blue,
    borderRadius: 12,
    padding: 12,
    marginTop: 24,
  },
  infoText: { color: C.muted, fontSize: 13, lineHeight: 18, flex: 1, marginLeft: 8 },
});