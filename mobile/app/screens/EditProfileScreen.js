import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  Image,
  ImageBackground,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";

import theme from "../theme";
import { fc, fundiCardShadow } from "../fundiTheme";
import ScreenWrapper from "../components/ScreenWrapper";
import FundiThemedScreen from "../components/FundiThemedScreen";
import PrimaryButton from "../components/PrimaryButton";
import {
  getProfile,
  updateProfile,
  uploadProfilePicture,
  uploadCoverPicture,
} from "../../services/usersApi";
import { resolveMediaUrl } from "../../utils/image";
import { initials } from "../utils/ratings";
import { useLanguage } from "../i18n/LanguageContext";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Field({ label, children, light }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, light && styles.labelFundi]}>{label}</Text>
      {children}
    </View>
  );
}

export default function EditProfileScreen({ onNavigate, userRole = 'customer' }) {
  const themed = userRole === 'fundi';
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);

  const [saved, setSaved] = useState(false);
  const savedAnim = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef(null);

  const showSavedToast = () => {
    setSaved(true);
    Animated.timing(savedAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      Animated.timing(savedAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setSaved(false));
    }, 2800);
  };

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const user = profile?.user || {};
  const fundiProfile = profile?.fundiProfile || {};
  const isFundi = user.role === "fundi";

  const [profilePhotoUri, setProfilePhotoUri] = useState("");
  const [coverPhotoUri, setCoverPhotoUri] = useState("");
  const [photoChanged, setPhotoChanged] = useState(false);
  const [coverChanged, setCoverChanged] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [locationText, setLocationText] = useState("");
  const [bio, setBio] = useState("");

  const avatarInitials = useMemo(() => {
    const name = fullName || user?.name || user?.firstName || "JD";
    return initials(name || "JD");
  }, [fullName, user?.name, user?.firstName]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const { data } = await getProfile();
        if (cancelled) return;
        setProfile(data);

        const name =
          (typeof data?.user?.name === "string" && data.user.name) ||
          [data?.user?.firstName, data?.user?.lastName]
            .filter(Boolean)
            .join(" ");

        setFullName(name || "");
        setEmail(data?.user?.email || "");
        setPhone(data?.user?.phone || "");
        setLocationText(data?.user?.locationLabel || data?.user?.address || "");
        setBio(fundiProfile?.bio || "");

        setProfilePhotoUri(
          data?.user?.profilePhoto
            ? resolveMediaUrl(data.user.profilePhoto)
            : data?.user?.avatarUrl ||
                data?.user?.avatar ||
                data?.user?.imageUrl ||
                "",
        );
        setCoverPhotoUri(
          data?.user?.coverPhoto
            ? resolveMediaUrl(data.user.coverPhoto)
            : data?.user?.coverUrl ||
                data?.user?.coverImage ||
                data?.user?.backgroundImage ||
                "",
        );
      } catch (e) {
        if (cancelled) return;
        setProfile(null);
        Alert.alert(t("Could not load profile"), t("Please try again."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const validate = () => {
    if (!fullName.trim()) return "Full name is required.";
    if (email && !EMAIL_RE.test(String(email).trim())) {
      return "Email looks invalid.";
    }
    return null;
  };

  const pickProfilePhoto = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          t("Permission required"),
          t("Please allow access to your photos."),
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) return;

      const uri = result.assets?.[0]?.uri;
      if (!uri) return;

      setProfilePhotoUri(uri);
      setPhotoChanged(true);
    } catch (e) {
      Alert.alert(t("Photo error"), t("Could not pick a profile photo."));
    }
  };

  const pickCoverPhoto = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          t("Permission required"),
          t("Please allow access to your photos."),
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.85,
      });

      if (result.canceled) return;

      const uri = result.assets?.[0]?.uri;
      if (!uri) return;

      setCoverPhotoUri(uri);
      setCoverChanged(true);
    } catch (e) {
      Alert.alert(t("Photo error"), t("Could not pick a cover photo."));
    }
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      Alert.alert(t("Fix form"), t(err));
      return;
    }

    try {
      setSaving(true);

      if (photoChanged && profilePhotoUri) {
        const formData = new FormData();
        formData.append("profilePicture", {
          uri: profilePhotoUri,
          type: "image/jpeg",
          name: "profile.jpg",
        });

        setUploadingPhoto(true);
        try {
          const { data: uploadData } = await uploadProfilePicture(formData);
          const uploadedPath =
            uploadData?.profilePhotoUrl || uploadData?.user?.profilePhoto;
          if (uploadedPath) {
            setProfilePhotoUri(resolveMediaUrl(uploadedPath, Date.now()));
          }
          setPhotoChanged(false);
        } finally {
          setUploadingPhoto(false);
        }
      }

      if (coverChanged && coverPhotoUri) {
        const formData = new FormData();
        formData.append("coverPicture", {
          uri: coverPhotoUri,
          type: "image/jpeg",
          name: "cover.jpg",
        });

        setUploadingCover(true);
        try {
          const { data: uploadData } = await uploadCoverPicture(formData);
          const uploadedPath =
            uploadData?.coverPhotoUrl || uploadData?.user?.coverPhoto;
          if (uploadedPath) {
            setCoverPhotoUri(resolveMediaUrl(uploadedPath, Date.now()));
          }
          setCoverChanged(false);
        } finally {
          setUploadingCover(false);
        }
      }

      const payload = {
        name: fullName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      };

      // Backend `updateProfile` applies arbitrary user fields, so the free-text
      // location is persisted as both display label and address.
      const location = locationText.trim();
      if (location) {
        payload.locationLabel = location;
        payload.address = location;
      }

      // `bio` is stored on `FundiProfile` and only written for fundis.
      if (isFundi && bio.trim()) payload.bio = bio.trim();

      await updateProfile(payload);

      const { data } = await getProfile();
      setProfile(data);
      if (data?.user?.profilePhoto) {
        setProfilePhotoUri(resolveMediaUrl(data.user.profilePhoto, Date.now()));
      }
      if (data?.user?.coverPhoto) {
        setCoverPhotoUri(resolveMediaUrl(data.user.coverPhoto, Date.now()));
      }

      showSavedToast();
    } catch (e) {
      const message =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        t("Unknown error");
      Alert.alert(t("Save failed"), message);
    } finally {
      setSaving(false);
    }
  };

  const pageTitle = themed ? t("Edit Fundi Profile") : t("Edit Profile");

  const content = (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {!themed ? (
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => onNavigate?.("profile")}
            style={styles.iconBtn}
          >
            <Ionicons name="chevron-back" size={20} color={theme.colors.white} />
          </TouchableOpacity>
          <Text style={styles.title}>{pageTitle}</Text>
          <View style={{ width: 40 }} />
        </View>
      ) : null}

      {saved ? (
        <Animated.View
          style={[
            styles.savedToast,
            themed && styles.savedToastFundi,
            {
              opacity: savedAnim,
              transform: [
                {
                  translateY: savedAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.savedIconWrap}>
            <Ionicons name="checkmark" size={16} color={theme.colors.textDark} />
          </View>
          <View style={styles.savedBody}>
            <Text style={[styles.savedTitle, themed && styles.fundiText]}>
              {t("Profile updated")}
            </Text>
            <Text style={[styles.savedMsg, themed && styles.fundiSub]}>
              {t("Your changes have been saved.")}
            </Text>
          </View>
        </Animated.View>
      ) : null}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={theme.colors.accent} size="large" />
          <Text style={[styles.loadingText, themed && styles.fundiSub]}>
            {t("Loading profile…")}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.coverWrap}>
            <ImageBackground
              source={coverPhotoUri ? { uri: coverPhotoUri } : undefined}
              style={styles.coverImage}
              imageStyle={styles.coverImageStyle}
            >
              {!coverPhotoUri ? (
                <LinearGradient
                  colors={["#3A2A0F", "#1A1A1A"]}
                  style={styles.coverFallback}
                >
                  <Ionicons
                    name="image-outline"
                    size={28}
                    color="rgba(255,255,255,0.35)"
                  />
                </LinearGradient>
              ) : null}

              <TouchableOpacity
                style={styles.coverBtn}
                onPress={pickCoverPhoto}
                disabled={uploadingCover || saving}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="camera"
                  size={14}
                  color={theme.colors.white}
                />
                <Text style={styles.coverBtnText}>
                  {coverPhotoUri ? t("Change") : t("Add cover")}
                </Text>
              </TouchableOpacity>

              {uploadingCover ? (
                <View style={styles.coverLoading}>
                  <ActivityIndicator color={theme.colors.accent} />
                </View>
              ) : null}
            </ImageBackground>

            <View style={styles.avatarWrap}>
              <LinearGradient
                colors={[theme.colors.accentLight, theme.colors.accentDark]}
                style={styles.avatarRing}
              >
                <View style={[styles.avatar, themed && styles.avatarFundi]}>
                  {profilePhotoUri ? (
                    <Image
                      source={{ uri: profilePhotoUri }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <Text style={styles.avatarText}>{avatarInitials}</Text>
                  )}
                  {uploadingPhoto ? (
                    <View style={styles.avatarLoading}>
                      <ActivityIndicator color={theme.colors.accent} />
                    </View>
                  ) : null}
                </View>
              </LinearGradient>
              <TouchableOpacity
                style={[styles.avatarEditBtn, themed && styles.avatarEditBtnFundi]}
                onPress={pickProfilePhoto}
                disabled={uploadingPhoto || saving}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="camera"
                  size={13}
                  color={theme.colors.textDark}
                />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.sectionTitle, themed && styles.fundiText]}>
            {t("Profile Details")}
          </Text>

          <Field label={t("Full Name")} light={themed}>
            <TextInput
              style={[styles.input, themed && styles.inputFundi]}
              value={fullName}
              onChangeText={setFullName}
              placeholder="John Doe"
              placeholderTextColor={themed ? fc.textSubtle : theme.colors.mutedDark}
              autoCapitalize="words"
            />
          </Field>

          <Field label={t("Email Address")} light={themed}>
            <TextInput
              style={[styles.input, themed && styles.inputFundi]}
              value={email}
              onChangeText={setEmail}
              placeholder="john.doe@email.com"
              placeholderTextColor={themed ? fc.textSubtle : theme.colors.mutedDark}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </Field>

          <Field label={t("Phone Number")} light={themed}>
            <TextInput
              style={[styles.input, themed && styles.inputFundi]}
              value={phone}
              onChangeText={setPhone}
              placeholder="+256 771 123 456"
              placeholderTextColor={themed ? fc.textSubtle : theme.colors.mutedDark}
              keyboardType="phone-pad"
            />
          </Field>

          <Field label={t("Location")} light={themed}>
            <TextInput
              style={[styles.input, themed && styles.inputFundi]}
              value={locationText}
              onChangeText={setLocationText}
              placeholder="Kampala, Uganda"
              placeholderTextColor={themed ? fc.textSubtle : theme.colors.mutedDark}
            />
          </Field>

          {isFundi ? (
            <Field label={t("Bio (Optional)")} light={themed}>
              <TextInput
                style={[styles.input, styles.textArea, themed && styles.inputFundi]}
                multiline
                value={bio}
                onChangeText={setBio}
                placeholder={t("Tell clients about your experience...")}
                placeholderTextColor={themed ? fc.textSubtle : theme.colors.mutedDark}
              />
            </Field>
          ) : null}

          <PrimaryButton
            onPress={handleSave}
            loading={saving}
            icon="checkmark"
            style={styles.saveBtn}
          >
            {t("Save Changes")}
          </PrimaryButton>
        </>
      )}
    </ScrollView>
  );

  if (themed) {
    return (
      <FundiThemedScreen title={pageTitle} onBack={() => onNavigate?.("profile")}>
        {content}
      </FundiThemedScreen>
    );
  }

  return (
    <ScreenWrapper style={styles.safe} edges={["top", "left", "right"]}>
      {content}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.black },
  container: { paddingHorizontal: 16, paddingBottom: 32 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    marginBottom: 16,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.input,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: theme.colors.white, fontWeight: "900", fontSize: 18 },

  savedToast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(34,197,94,0.12)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.35)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  savedIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.green,
    justifyContent: "center",
    alignItems: "center",
  },
  savedBody: { flex: 1, gap: 2 },
  savedTitle: { color: theme.colors.white, fontWeight: "800", fontSize: 14 },
  savedMsg: { color: theme.colors.muted, fontSize: 12 },

  loadingWrap: {
    paddingVertical: 60,
    alignItems: "center",
  },
  loadingText: { color: theme.colors.muted, marginTop: 12, fontSize: 13 },

  coverWrap: { marginBottom: 8 },
  coverImage: {
    height: 150,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: theme.colors.black,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: "flex-end",
  },
  coverImageStyle: { resizeMode: "cover" },
  coverFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  coverLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  coverBtn: {
    position: "absolute",
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  coverBtnText: { color: theme.colors.white, fontWeight: "800", fontSize: 12 },

  avatarWrap: {
    alignSelf: "center",
    marginTop: -44,
    width: 88,
    position: "relative",
    alignItems: "center",
  },
  avatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    padding: 3,
    ...theme.elevation.md,
  },
  avatar: {
    flex: 1,
    borderRadius: 41,
    backgroundColor: "#121212",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%", resizeMode: "cover" },
  avatarText: { color: theme.colors.white, fontWeight: "900", fontSize: 24 },
  avatarLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEditBtn: {
    position: "absolute",
    right: -6,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.accent,
    borderWidth: 2.5,
    borderColor: theme.colors.black,
    justifyContent: "center",
    alignItems: "center",
    ...theme.elevation.sm,
  },

  sectionTitle: {
    color: theme.colors.white,
    fontWeight: "900",
    fontSize: 15,
    marginTop: 20,
    marginBottom: 4,
  },

  field: { marginBottom: 14 },
  label: {
    color: theme.colors.muted,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: "700",
  },
  input: {
    backgroundColor: theme.colors.input,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.colors.white,
    fontSize: 14,
  },
  textArea: { minHeight: 96, textAlignVertical: "top" },

  saveBtn: { marginTop: 24 },

  fundiText: { color: fc.text },
  fundiSub: { color: fc.textMuted },
  labelFundi: { color: fc.textMuted },
  inputFundi: {
    backgroundColor: fc.card,
    borderColor: fc.border,
    color: fc.text,
    ...fundiCardShadow,
  },
  avatarFundi: { backgroundColor: fc.card },
  avatarEditBtnFundi: { borderColor: fc.card },
  savedToastFundi: { backgroundColor: fc.card, borderColor: fc.border },
});
