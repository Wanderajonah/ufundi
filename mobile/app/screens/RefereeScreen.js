import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import theme from "../theme";
import ScreenWrapper from "../components/ScreenWrapper";
import api from "../../services/api";

const C = {
  page: theme.colors.bgLight,
  card: "#FFFFFF",
  border: "#E4E4E0",
  dashboard: "#1A1A1A",
  text: "#1A1A1A",
  muted: "#6B6B68",
  amber: "#FAEEDA",
  amberDark: "#854F0B",
  amberAccent: "#FFB800",
  blue: "#E6F1FB",
  blueDark: "#185FA5",
  pillGray: "#EDEDEA",
  dashed: "#C9C9C4",
  green: "#22C55E",
  red: "#EF4444",
  input: "#F5F5F4",
};

const REQUIRED_REFS = 2;
const MAX_REFS = 5;

const RELATIONSHIP_OPTIONS = [
  "Former client",
  "Employer",
  "Colleague",
  "Supervisor",
  "Community leader",
  "Other",
];

export default function RefereeScreen({ onNavigate, userRole }) {
  const insets = useSafeAreaInsets();
  const [referees, setReferees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "",
    relationship: "",
    phoneNumber: "",
    email: "",
  });
  const [errors, setErrors] = useState({});

  const loadReferees = useCallback(async () => {
    try {
      const { data } = await api.get("/users/referees");
      setReferees(data);
    } catch (e) {
      console.warn("Failed to load referees:", e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReferees();
  }, [loadReferees]);

  const canFinish = referees.length >= REQUIRED_REFS;

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.relationship) errs.relationship = "Select a relationship";
    if (!form.phoneNumber.trim()) errs.phoneNumber = "Phone number is required";
    else if (form.phoneNumber.replace(/\D/g, "").length < 10)
      errs.phoneNumber = "Enter a valid phone number";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAdd = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const { data } = await api.post("/users/referees", {
        name: form.name.trim(),
        relationship: form.relationship,
        phoneNumber: form.phoneNumber.trim(),
        email: form.email.trim(),
      });
      setReferees((prev) => [...prev, data]);
      setForm({ name: "", relationship: "", phoneNumber: "", email: "" });
      setErrors({});
      setShowAdd(false);
    } catch (e) {
      Alert.alert("Error", e.response?.data?.message || "Failed to add referee");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    Alert.alert("Remove Referee", "Are you sure you want to remove this referee?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/users/referees/${id}`);
            setReferees((prev) => prev.filter((r) => r._id !== id));
          } catch (e) {
            Alert.alert("Error", "Failed to remove referee");
          }
        },
      },
    ]);
  };

  const handleFinish = () => {
    if (onNavigate) onNavigate("verification");
  };

  const isLight = userRole === "fundi";

  return (
    <ScreenWrapper variant={isLight ? "fundi" : "dark"} style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (onNavigate ? onNavigate("verification") : null)}
        >
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>References</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="people-outline" size={36} color={C.amberDark} />
          </View>
          <View style={[styles.heroPill, { backgroundColor: C.amber }]}>
            <Text style={styles.heroPillText}>
              {referees.length} of {REQUIRED_REFS} added
            </Text>
          </View>
          <Text style={styles.heroDesc}>
            Add at least {REQUIRED_REFS} referees who can vouch for your work —
            a past client, employer, or someone who knows your trade.
          </Text>
        </View>

        {/* Referees Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Referees</Text>
          <Text style={styles.sectionDesc}>
            People clients or Fundi Connect may contact to confirm your work.
          </Text>

          {loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="small" color={C.muted} />
            </View>
          ) : referees.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No referees added yet</Text>
            </View>
          ) : (
            referees.map((ref) => (
              <View key={ref._id} style={styles.refCard}>
                <View style={styles.refAvatar}>
                  <Ionicons name="person" size={18} color={C.muted} />
                </View>
                <View style={styles.refInfo}>
                  <Text style={styles.refName}>{ref.name}</Text>
                  <Text style={styles.refMeta}>
                    {ref.relationship} · {ref.phoneNumber}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.refDelete}
                  onPress={() => handleDelete(ref._id)}
                >
                  <Ionicons name="trash-outline" size={18} color={C.red} />
                </TouchableOpacity>
              </View>
            ))
          )}

          {/* Add Referee Button */}
          {referees.length < MAX_REFS && (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setShowAdd(true)}
            >
              <View style={styles.addBtnIcon}>
                <Ionicons name="person-add-outline" size={18} color={C.muted} />
              </View>
              <View style={styles.addBtnTextWrap}>
                <Text style={styles.addBtnText}>Add a referee</Text>
                <Text style={styles.addBtnMeta}>
                  Name, relationship and phone number
                </Text>
              </View>
              <Text style={styles.addBtnCount}>
                {referees.length}/{MAX_REFS}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Finish Button */}
        <TouchableOpacity
          style={[styles.finishBtn, !canFinish && styles.finishBtnDisabled]}
          onPress={handleFinish}
          disabled={!canFinish}
        >
          <Text style={[styles.finishText, !canFinish && styles.finishTextDisabled]}>
            Finish
          </Text>
        </TouchableOpacity>

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle-outline" size={18} color={C.blueDark} />
          <Text style={styles.infoText}>
            References are only contacted at the time of verification by the
            administrators.
          </Text>
        </View>
      </ScrollView>

      {/* Add Referee Modal */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowAdd(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add a referee</Text>

            {/* Name */}
            <Text style={styles.fieldLabel}>Full name</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              placeholder="e.g. Jane Nakamya"
              placeholderTextColor={C.muted}
              value={form.name}
              onChangeText={(v) => {
                setForm((f) => ({ ...f, name: v }));
                if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
              }}
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

            {/* Relationship */}
            <Text style={styles.fieldLabel}>Relationship</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.pillRow}
            >
              {RELATIONSHIP_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.relPill,
                    form.relationship === opt && styles.relPillActive,
                  ]}
                  onPress={() => {
                    setForm((f) => ({ ...f, relationship: opt }));
                    if (errors.relationship)
                      setErrors((e) => ({ ...e, relationship: undefined }));
                  }}
                >
                  <Text
                    style={[
                      styles.relPillText,
                      form.relationship === opt && styles.relPillTextActive,
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {errors.relationship && (
              <Text style={styles.errorText}>{errors.relationship}</Text>
            )}

            {/* Phone */}
            <Text style={styles.fieldLabel}>Phone number</Text>
            <TextInput
              style={[styles.input, errors.phoneNumber && styles.inputError]}
              placeholder="e.g. 0700123456"
              placeholderTextColor={C.muted}
              keyboardType="phone-pad"
              value={form.phoneNumber}
              onChangeText={(v) => {
                setForm((f) => ({ ...f, phoneNumber: v }));
                if (errors.phoneNumber)
                  setErrors((e) => ({ ...e, phoneNumber: undefined }));
              }}
            />
            {errors.phoneNumber && (
              <Text style={styles.errorText}>{errors.phoneNumber}</Text>
            )}

            {/* Email (optional) */}
            <Text style={styles.fieldLabel}>Email (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. jane@example.com"
              placeholderTextColor={C.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={form.email}
              onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
            />

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowAdd(false);
                  setForm({ name: "", relationship: "", phoneNumber: "", email: "" });
                  setErrors({});
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleAdd}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.saveText}>Add referee</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.pillGray,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: C.text },
  scroll: { flex: 1 },

  // Hero
  heroCard: {
    backgroundColor: C.card,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.amber,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  heroPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 14,
  },
  heroPillText: { fontSize: 13, fontWeight: "700", color: C.amberDark },
  heroDesc: {
    fontSize: 14,
    color: C.muted,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 8,
  },

  // Section
  section: { marginTop: 20, marginHorizontal: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: C.text, marginBottom: 4 },
  sectionDesc: { fontSize: 13, color: C.muted, marginBottom: 14, lineHeight: 18 },

  // Empty state
  emptyState: {
    backgroundColor: C.card,
    borderRadius: 12,
    paddingVertical: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: "dashed",
  },
  emptyText: { fontSize: 14, color: C.muted },

  // Referee card
  refCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  refAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.pillGray,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  refInfo: { flex: 1 },
  refName: { fontSize: 14, fontWeight: "600", color: C.text },
  refMeta: { fontSize: 12, color: C.muted, marginTop: 2 },
  refDelete: { padding: 8 },

  // Add button
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    marginTop: 6,
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: "dashed",
  },
  addBtnIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.pillGray,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  addBtnTextWrap: { flex: 1 },
  addBtnText: { fontSize: 14, fontWeight: "600", color: C.text },
  addBtnMeta: { fontSize: 12, color: C.muted, marginTop: 1 },
  addBtnCount: { fontSize: 13, color: C.muted, fontWeight: "500" },

  // Finish
  finishBtn: {
    backgroundColor: C.dashboard,
    borderRadius: 14,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    marginHorizontal: 16,
  },
  finishBtnDisabled: { backgroundColor: C.pillGray },
  finishText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  finishTextDisabled: { color: C.muted },

  // Info
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: C.blue,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    marginHorizontal: 16,
    gap: 8,
  },
  infoText: { flex: 1, fontSize: 13, color: C.blueDark, lineHeight: 18 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  modalContent: {
    backgroundColor: C.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: C.text, marginBottom: 20 },

  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: C.muted,
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: C.input,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
  },
  inputError: { borderColor: C.red },
  errorText: { fontSize: 12, color: C.red, marginTop: 4 },

  pillRow: { flexDirection: "row", marginBottom: 4 },
  relPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.pillGray,
    marginRight: 8,
  },
  relPillActive: { backgroundColor: C.amberAccent },
  relPillText: { fontSize: 13, fontWeight: "500", color: C.muted },
  relPillTextActive: { color: C.dashboard },

  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 28,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: C.pillGray,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontSize: 14, fontWeight: "600", color: C.muted },
  saveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: C.dashboard,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
});
