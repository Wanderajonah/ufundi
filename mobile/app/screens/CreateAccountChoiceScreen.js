import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScrollScreen from "../components/ScrollScreen";
import AuthHeader from "../components/AuthHeader";
import AuthButton from "../components/AuthButton";
import theme from "../theme";
import { useLanguage } from "../i18n/LanguageContext";

/**
 * Collects first/last name up front (required by the phone-register
 * backend endpoint), then lets the user pick Phone or Google.
 *  - Phone path: name fields are required here, carried into the OTP
 *    register call. After the one-time code, fundis continue to profile
 *    setup and verification; clients go to location setup (no email/DOB).
 *  - Google path: name fields here are optional/skippable — Google
 *    supplies its own name + email.
 */
export default function CreateAccountChoiceScreen({
  role = "client",
  onBack,
  onPhoneContinue,
  onGoogleContinue,
}) {
  const isFundi = role === "fundi";
  const { t } = useLanguage();
  const roleLabel = isFundi ? t("I am a Fundi") : t("Find a Fundi");
  const roleIcon = isFundi ? "build" : "search";
  const pillBg = theme.colors.accentDim;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [focused, setFocused] = useState(null);

  const nameOk = Boolean(firstName.trim() && lastName.trim());

  const inputRowStyle = (key) => [styles.inputRow, focused === key && styles.inputRowFocused];

  const handlePhone = () => {
    if (!nameOk) {
      Alert.alert(t("Almost there"), t("Enter your first and last name to continue."));
      return;
    }
    onPhoneContinue?.({
      role,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    });
  };

  const handleGoogle = () => {
    // Name fields are optional for Google — Google's own profile data
    // takes precedence regardless.
    onGoogleContinue?.({ role });
  };

  return (
    <ScrollScreen keyboard contentStyle={styles.scroll} bottomPad={32}>
      <AuthHeader
        onBack={onBack}
        title={t("Create your account")}
        subtitle={t("Tell us your name, then choose how to verify your details.")}
        right={
          <View style={[styles.rolePill, { backgroundColor: pillBg }]}>
            <View style={styles.rolePillIcon}>
              <Ionicons name={roleIcon} size={12} color={theme.colors.black} />
            </View>
            <Text style={styles.rolePillText}>{roleLabel}</Text>
          </View>
        }
      />

      <View style={styles.form}>
        <Text style={styles.sectionLabel}>{t("FIRST NAME")}</Text>
        <View style={inputRowStyle("firstName")}>
          <Ionicons name="person-outline" size={18} color={theme.colors.muted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder={t("e.g. John")}
            placeholderTextColor={theme.colors.mutedDark}
            autoCapitalize="words"
            onFocus={() => setFocused("firstName")}
            onBlur={() => setFocused(null)}
          />
        </View>

        <Text style={styles.sectionLabel}>{t("LAST NAME")}</Text>
        <View style={inputRowStyle("lastName")}>
          <Ionicons name="person-outline" size={18} color={theme.colors.muted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder={t("e.g. Mukasa")}
            placeholderTextColor={theme.colors.mutedDark}
            autoCapitalize="words"
            onFocus={() => setFocused("lastName")}
            onBlur={() => setFocused(null)}
          />
        </View>
        <Text style={styles.helper}>
          {t("Required for phone sign-up. Skip if you're continuing with Google.")}
        </Text>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="call-outline" size={18} color={theme.colors.accent} />
            <Text style={styles.cardTitle}>{t("Phone number")}</Text>
          </View>
          <Text style={styles.cardSubtext}>
            {t("We'll text you a one-time code to confirm your number.")}
          </Text>
          <AuthButton
            variant="phone"
            label={t("Continue with Phone Number")}
            onPress={handlePhone}
            style={{ marginTop: 14 }}
          />
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t("OR")}</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="logo-google" size={18} color={theme.colors.accent} />
            <Text style={styles.cardTitle}>{t("Google")}</Text>
          </View>
          <Text style={styles.cardSubtext}>
            {t("We'll pull your name and email from Google automatically.")}
          </Text>
          <AuthButton
            variant="google"
            label={t("Continue with Google")}
            onPress={handleGoogle}
            style={{ marginTop: 14 }}
          />
        </View>
      </View>

      <TouchableOpacity onPress={onBack} style={styles.footerLink}>
        <Text style={styles.footerLinkText}>{t("Go back")}</Text>
      </TouchableOpacity>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24 },

  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(245,166,35,0.3)",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    paddingLeft: 8,
  },
  rolePillIcon: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  rolePillText: { color: theme.colors.accent, fontSize: 13, fontWeight: "700" },

  form: { marginTop: 24 },

  sectionLabel: {
    color: theme.colors.muted,
    fontWeight: "700",
    fontSize: 11.5,
    letterSpacing: 0.6,
    marginBottom: 10,
    marginTop: 18,
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.input,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 10,
  },
  inputRowFocused: { borderColor: theme.colors.accent },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: theme.colors.white, fontSize: 15.5, padding: 0 },
  helper: { color: theme.colors.mutedDark, fontSize: 12, lineHeight: 18, marginTop: 2, marginBottom: 16 },

  card: {
    backgroundColor: theme.colors.input,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
    marginBottom: 4,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { color: theme.colors.white, fontWeight: "700", fontSize: 15.5 },
  cardSubtext: { color: theme.colors.mutedDark, fontSize: 12.5, lineHeight: 18, marginTop: 6 },

  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  dividerText: { color: theme.colors.muted, fontSize: 12, fontWeight: "600", marginHorizontal: 12 },

  footerLink: { marginTop: 18, alignSelf: "center" },
  footerLinkText: { color: theme.colors.muted, fontWeight: "700" },
});