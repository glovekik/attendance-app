import React, {
  useState,
  useCallback, useMemo} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter, useFocusEffect } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  listTeams,
  createTeam,
  listMyLedTeams } from "../../src/services/teams";

import { listUsers } from "../../src/services/users";
import { getMe } from "../../src/services/api";

import { useTheme } from "../../src/theme/ThemeProvider";
import {
  Team,
  User,
  hasRole } from "../../src/types";

export default function Teams() {

  const router = useRouter();

  const { theme } = useTheme();

  const c = theme.colors;

  const styles = useMemo(() => makeStyles(c), [c]);

  const [me, setMe] = useState<User | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState("");
  const [leadId, setLeadId] = useState<string>("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [popup, setPopup] = useState({
    visible: false,
    type: "success" as "success" | "error",
    message: "" });

  const showPopup = (
    msg: string,
    kind: "success" | "error" = "success"
  ) => {
    setPopup({ visible: true, type: kind, message: msg });
    setTimeout(() => {
      setPopup((p) => ({ ...p, visible: false }));
    }, 2500);
  };

  const isHR = hasRole(me, "HR");

  // ================= LOAD =================
  const load = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }

      const meRes = await getMe(token);
      setMe(meRes);

      if (hasRole(meRes, "HR")) {
        const [teamsRes, usersRes] = await Promise.all([
          listTeams(token),
          listUsers(token),
        ]);
        setTeams(teamsRes || []);
        // Drop terminated users so they don't appear in team-lead /
        // member pickers downstream.
        setUsers(
          (usersRes || []).filter((u) => u.status !== "Terminated")
        );
      } else {
        const ledTeams = await listMyLedTeams(token);
        setTeams(ledTeams || []);
      }

    } catch (err: any) {
      showPopup(err?.message || "Failed to load teams", "error");
    }

    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const userName = (id: string) => {
    const u = users.find((x) => x.id === id);
    return u?.name || id.slice(-6);
  };

  const toggleMember = (id: string) => {
    setMemberIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  };

  const openCreate = () => {
    setName("");
    setLeadId("");
    setMemberIds([]);
    setModalVisible(true);
  };

  // ================= CREATE =================
  const save = async () => {

    if (saving) return;

    if (!name.trim()) {
      showPopup("Team name required", "error");
      return;
    }
    if (!leadId) {
      showPopup("Pick a team lead", "error");
      return;
    }

    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      await createTeam(token, {
        name: name.trim(),
        teamLeadId: leadId,
        memberIds });

      showPopup("Team created");
      setModalVisible(false);
      await load();

    } catch (err: any) {
      showPopup(err?.message || "Failed to create", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>

      {popup.visible && (
        <View
          style={[
            styles.popup,
            popup.type === "success"
              ? styles.successPopup
              : styles.errorPopup,
          ]}
        >
          <Text style={styles.popupText}>{popup.message}</Text>
        </View>
      )}

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          >
            <Ionicons name="chevron-back" size={22} color={c.text} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Teams</Text>
            <Text style={styles.subtitle}>
              {teams.length} {isHR ? "total" : "you lead"}
            </Text>
          </View>

          {isHR && (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={openCreate}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {teams.map((t) => {
          const leadDisplay = isHR
            ? userName(t.teamLeadId)
            : t.leadName || (me?.name || "you");

          return (
            <TouchableOpacity
              key={t.id}
              style={styles.card}
              onPress={() => router.push(`/teams/${t.id}`)}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: "#7c3aed" },
                ]}
              >
                <Ionicons
                  name="people-outline"
                  size={20}
                  color="#fff"
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{t.name}</Text>
                <Text style={styles.cardMeta}>
                  Lead: {leadDisplay}  ·  {t.memberIds.length} members
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={20}
                color={c.textMuted}
              />
            </TouchableOpacity>
          );
        })}

        {teams.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No teams yet</Text>
            <Text style={styles.emptySub}>
              {isHR
                ? "Tap + to create your first team."
                : "You're not leading any team yet."}
            </Text>
          </View>
        )}

      </ScrollView>

      {/* CREATE MODAL */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>

              <Text style={styles.modalTitle}>New Team</Text>

              <Text style={styles.label}>Team Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Backend Squad"
                placeholderTextColor={c.textFaint}
              />

              <Text style={styles.label}>Team Lead</Text>
              <View style={styles.userPicker}>
                {users.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    style={[
                      styles.userPickBtn,
                      leadId === u.id && styles.userPickActive,
                    ]}
                    onPress={() => setLeadId(u.id)}
                  >
                    <Text
                      style={[
                        styles.userPickText,
                        leadId === u.id && { color: "#fff" },
                      ]}
                    >
                      {u.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Members</Text>
              <View style={styles.userPicker}>
                {users.map((u) => {
                  const active = memberIds.includes(u.id);
                  return (
                    <TouchableOpacity
                      key={u.id}
                      style={[
                        styles.userPickBtn,
                        active && styles.userPickActive,
                      ]}
                      onPress={() => toggleMember(u.id)}
                    >
                      <Text
                        style={[
                          styles.userPickText,
                          active && { color: "#fff" },
                        ]}
                      >
                        {u.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                  onPress={save}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalBtnText}>Create</Text>
                  )}
                </TouchableOpacity>
              </View>

            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  loader: {
    flex: 1,
    backgroundColor: c.bg,
    justifyContent: "center",
    alignItems: "center" },

  popup: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    padding: 14,
    borderRadius: 14,
    zIndex: 999 },
  successPopup: { backgroundColor: "#16a34a" },
  errorPopup: { backgroundColor: "#dc2626" },
  popupText: { color: c.text, fontWeight: "700", textAlign: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    marginTop: 10,
    gap: 12 },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: c.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: c.accent,
    justifyContent: "center",
    alignItems: "center" },
  title: { color: c.text, fontSize: 24, fontWeight: "800" },
  subtitle: { color: c.textMuted, fontSize: 13, marginTop: 3 },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    gap: 12 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center" },
  cardName: { color: c.text, fontSize: 15, fontWeight: "700" },
  cardMeta: { color: c.textMuted, fontSize: 12, marginTop: 3 },

  emptyBox: {
    alignItems: "center",
    padding: 40,
    backgroundColor: c.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    marginTop: 20 },
  emptyTitle: { color: c.text, fontSize: 16, fontWeight: "700" },
  emptySub: {
    color: c.textMuted,
    fontSize: 13,
    marginTop: 6,
    textAlign: "center" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(29,24,56,0.35)",
    justifyContent: "center",
    padding: 20 },
  modalCard: {
    backgroundColor: c.surface,
    borderRadius: 18,
    padding: 20,
    maxHeight: "90%" },
  modalTitle: {
    color: c.text,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 16 },

  label: {
    color: c.textMuted,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 12 },
  input: {
    backgroundColor: c.surfaceMuted,
    color: c.text,
    borderRadius: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: "#1e293b",
    fontSize: 14 },

  userPicker: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap" },
  userPickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#1e293b" },
  userPickActive: { backgroundColor: c.accent },
  userPickText: { color: c.textMuted, fontWeight: "600", fontSize: 13 },

  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22 },
  cancelBtn: {
    flex: 1,
    backgroundColor: c.surfaceMuted,
    padding: 14,
    borderRadius: 12,
    alignItems: "center" },
  saveBtn: {
    flex: 1,
    backgroundColor: "#16a34a",
    padding: 14,
    borderRadius: 12,
    alignItems: "center" },
  modalBtnText: { color: c.text, fontWeight: "700" } });
