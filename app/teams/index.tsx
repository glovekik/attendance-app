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
  Platform,
  Modal } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter, useFocusEffect } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  listTeams,
  createTeam,
  updateTeam,
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
  // null = creating a new team; a team id = editing that team.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [leadId, setLeadId] = useState<string>("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // Search filters for the manager / member pickers in the modal.
  const [leadSearch, setLeadSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");

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
    // User no longer exists (deleted / re-created with a new id) — show a
    // clear label rather than a cryptic id slice or "?".
    return u?.name || "Unknown user";
  };

  const toggleMember = (id: string) => {
    setMemberIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  };

  const openCreate = () => {
    setEditingId(null);
    setName("");
    setLeadId("");
    setMemberIds([]);
    setLeadSearch("");
    setMemberSearch("");
    setModalVisible(true);
  };

  const openEdit = (t: Team) => {
    setEditingId(t.id);
    setName(t.name);
    setLeadSearch("");
    setMemberSearch("");
    // Drop any lead/member whose user no longer exists (deleted &
    // re-created with a new id) — `users` only holds live, non-terminated
    // accounts. This both hides the broken "Former member" rows from the
    // picker and removes those stale ids when HR saves, correcting the team.
    const live = new Set(users.map((u) => u.id));
    setLeadId(live.has(t.teamLeadId) ? t.teamLeadId : "");
    setMemberIds((t.memberIds || []).filter((id) => live.has(id)));
    setModalVisible(true);
  };

  // ================= CREATE / UPDATE =================
  const save = async () => {

    if (saving) return;

    if (!name.trim()) {
      showPopup("Team name required", "error");
      return;
    }
    if (!leadId) {
      showPopup("Pick a manager", "error");
      return;
    }

    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      if (editingId) {
        await updateTeam(token, editingId, {
          name: name.trim(),
          teamLeadId: leadId,
          memberIds });
        showPopup("Team updated");
      } else {
        await createTeam(token, {
          name: name.trim(),
          teamLeadId: leadId,
          memberIds });
        showPopup("Team created");
      }

      setModalVisible(false);
      await load();

    } catch (err: any) {
      showPopup(
        err?.message || (editingId ? "Failed to update" : "Failed to create"),
        "error"
      );
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

  // ---- Modal picker helpers ----
  const matches = (u: User, q: string) =>
    !q.trim() ||
    `${u.name} ${u.email || ""}`.toLowerCase().includes(q.trim().toLowerCase());

  const leadMatches = users.filter((u) => matches(u, leadSearch));
  // Members already chosen, resolved to user objects (in selection order).
  const selectedMembers = memberIds
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is User => !!u);
  // Everyone not yet a member, narrowed by the search box.
  const availableMembers = users.filter(
    (u) => !memberIds.includes(u.id) && matches(u, memberSearch)
  );

  const initial = (s: string) => (s || "?").charAt(0).toUpperCase();

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
              {teams.length} {isHR ? "total" : "you manage"}
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
                  Manager: {leadDisplay}  ·  {t.memberIds.length} members
                </Text>
              </View>

              {isHR && (
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => openEdit(t)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="create-outline"
                    size={20}
                    color={c.textMuted}
                  />
                </TouchableOpacity>
              )}

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
                : "No teams to show yet."}
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
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior="padding"
        >
          <View style={styles.modalCard}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >

              <Text style={styles.modalTitle}>
                {editingId ? "Edit Team" : "New Team"}
              </Text>

              <Text style={styles.label}>Team Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Backend Squad"
                placeholderTextColor={c.textFaint}
              />

              <Text style={styles.label}>Manager</Text>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={16} color={c.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  value={leadSearch}
                  onChangeText={setLeadSearch}
                  placeholder="Search to pick a manager"
                  placeholderTextColor={c.textFaint}
                />
              </View>
              <View style={styles.pickList}>
                {leadMatches.length === 0 && (
                  <Text style={styles.pickHint}>No matching people.</Text>
                )}
                {leadMatches.map((u) => {
                  const active = leadId === u.id;
                  return (
                    <TouchableOpacity
                      key={u.id}
                      style={[styles.personRow, active && styles.personRowActive]}
                      onPress={() => setLeadId(u.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.personAvatar}>
                        <Text style={styles.personAvatarText}>
                          {initial(u.name)}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.personName} numberOfLines={1}>
                          {u.name}
                        </Text>
                        {!!u.email && (
                          <Text style={styles.personEmail} numberOfLines={1}>
                            {u.email}
                          </Text>
                        )}
                      </View>
                      <Ionicons
                        name={active ? "radio-button-on" : "radio-button-off"}
                        size={20}
                        color={active ? c.accent : c.textMuted}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>
                Members ({selectedMembers.length})
              </Text>
              {/* Chosen members — tap × to remove */}
              {selectedMembers.length > 0 ? (
                <View style={styles.chipWrap}>
                  {selectedMembers.map((u) => (
                    <View key={u.id} style={styles.memberChip}>
                      <Text style={styles.memberChipText} numberOfLines={1}>
                        {u.name}
                      </Text>
                      <TouchableOpacity
                        onPress={() => toggleMember(u.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                      >
                        <Ionicons name="close-circle" size={18} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.pickHint}>No members added yet.</Text>
              )}

              {/* Search + add people */}
              <View style={styles.searchBox}>
                <Ionicons name="search" size={16} color={c.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  value={memberSearch}
                  onChangeText={setMemberSearch}
                  placeholder="Search people to add"
                  placeholderTextColor={c.textFaint}
                />
              </View>
              <View style={styles.pickList}>
                {availableMembers.length === 0 && (
                  <Text style={styles.pickHint}>
                    {memberSearch.trim()
                      ? "No matching people."
                      : "Everyone is already a member."}
                  </Text>
                )}
                {availableMembers.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    style={styles.personRow}
                    onPress={() => toggleMember(u.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.personAvatar}>
                      <Text style={styles.personAvatarText}>
                        {initial(u.name)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.personName} numberOfLines={1}>
                        {u.name}
                      </Text>
                      {!!u.email && (
                        <Text style={styles.personEmail} numberOfLines={1}>
                          {u.email}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="add-circle" size={22} color={c.accent} />
                  </TouchableOpacity>
                ))}
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
                    <Text style={styles.modalBtnText}>
                      {editingId ? "Save" : "Create"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
  editBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: c.surfaceMuted,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6 },
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

  // Search box for the manager / member pickers.
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: c.surfaceMuted,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  searchInput: {
    flex: 1,
    color: c.text,
    fontSize: 14,
    padding: 0 },

  // Selectable person rows (manager + add-member lists).
  pickList: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    overflow: "hidden" },
  pickHint: {
    color: c.textMuted,
    fontSize: 13,
    paddingVertical: 12,
    paddingHorizontal: 12,
    textAlign: "center" },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceBorder },
  personRowActive: { backgroundColor: c.accentSoft },
  personAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: c.surfaceMuted,
    justifyContent: "center",
    alignItems: "center" },
  personAvatarText: { color: c.accent, fontWeight: "800", fontSize: 14 },
  personName: { color: c.text, fontSize: 14, fontWeight: "600" },
  personEmail: { color: c.textMuted, fontSize: 11, marginTop: 1 },

  // Chosen-member chips with a remove (×) action.
  chipWrap: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap" },
  memberChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: c.accent,
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 7,
    maxWidth: "100%" },
  memberChipText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
    flexShrink: 1 },

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
