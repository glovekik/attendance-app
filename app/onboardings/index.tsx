import React, {
  useEffect,
  useState, useMemo} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  hrCreateOnboarding,
  hrListOnboardings } from "../../src/services/onboarding";

import { listUsers } from "../../src/services/users";

import { Onboarding, User } from "../../src/types";

import { useTheme } from "../../src/theme/ThemeProvider";

import { WebModal, ModalActions } from "../../src/components/WebModal";

export default function HROnboardings() {

  const router = useRouter();

  const { theme } = useTheme();

  const c = theme.colors;

  const s = useMemo(() => makeStyles(c), [c]);

  const [items, setItems] = useState<Onboarding[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [pickerVisible, setPickerVisible] = useState(false);
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

  const load = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const [list, allUsers] = await Promise.all([
        hrListOnboardings(token),
        listUsers(token).catch(() => [] as User[]),
      ]);
      setItems(list || []);
      setUsers(allUsers || []);
    } catch (err: any) {
      showPopup(err?.message || "Failed to load", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const userName = (id: string) => {
    return (
      users.find((u) => u.id === id)?.name || `…${id.slice(-4)}`
    );
  };

  const startOnboarding = async (userId: string) => {
    if (saving) return;
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrCreateOnboarding(token, userId);
      showPopup("Onboarding started");
      setPickerVisible(false);
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed to create", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  // Users without onboarding yet
  const onboardedIds = new Set(items.map((o) => o.userId));
  const unboarded = users.filter((u) => !onboardedIds.has(u.id));

  return (
    <SafeAreaView style={s.safe}>

      {popup.visible && (
        <View
          style={[
            s.popup,
            popup.type === "success" ? s.popupOk : s.popupErr,
          ]}
        >
          <Text style={s.popupText}>{popup.message}</Text>
        </View>
      )}

      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
      >

        <View style={s.header}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          >
            <Ionicons name="chevron-back" size={22} color={c.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Onboardings</Text>
            <Text style={s.subtitle}>{items.length} active</Text>
          </View>
          <TouchableOpacity
            style={s.addBtn}
            onPress={() => setPickerVisible(true)}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {items.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>No onboardings yet</Text>
            <Text style={s.emptySub}>
              Tap + to start one for a new hire.
            </Text>
          </View>
        )}

        {items.map((o) => {
          const docDone = o.documents.filter((d) =>
            ["VERIFIED", "UPLOADED"].includes(d.status)
          ).length;
          const hrDone = o.hrTasks.filter((t) => t.status === "DONE").length;
          const empDone = o.employeeTasks.filter((t) => t.status === "DONE").length;
          return (
            <TouchableOpacity
              key={o.id}
              style={s.card}
              onPress={() =>
                router.push(`/onboardings/${o.id}`)
              }
              activeOpacity={0.85}
            >
              <View style={s.avatar}>
                <Text style={s.avatarText}>
                  {(o.user?.name || userName(o.userId))
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardName}>
                  {o.user?.name || userName(o.userId)}
                </Text>
                <Text style={s.cardMeta}>
                  Docs {docDone}/{o.documents.length}
                  {"  ·  "}
                  HR {hrDone}/{o.hrTasks.length}
                  {"  ·  "}
                  Emp {empDone}/{o.employeeTasks.length}
                </Text>
              </View>
              {(() => {
                const tone =
                  o.status === "COMPLETED"
                    ? { bg: c.successBg, fg: c.successText }
                    : o.status === "IN_PROGRESS"
                    ? { bg: c.accentSoft, fg: c.accentText }
                    : { bg: c.warningBg, fg: c.warningText };
                return (
                  <View
                    style={[s.statusChip, { backgroundColor: tone.bg }]}
                  >
                    <Text style={[s.statusText, { color: tone.fg }]}>
                      {o.status.replace("_", " ")}
                    </Text>
                  </View>
                );
              })()}
              <Ionicons
                name="chevron-forward"
                size={18}
                color={c.textMuted}
              />
            </TouchableOpacity>
          );
        })}

      </ScrollView>

      <WebModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        title="Start Onboarding"
        size="lg"
        footer={
          <ModalActions align="right">
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={() => setPickerVisible(false)}
            >
              <Text style={s.modalBtnText}>Close</Text>
            </TouchableOpacity>
          </ModalActions>
        }
      >
        <Text style={s.hint}>
          Pick a user with no active onboarding.
        </Text>

        {unboarded.length === 0 ? (
          <Text style={[s.emptySub, { marginTop: 14 }]}>
            Everyone already has an onboarding record.
          </Text>
        ) : (
          unboarded.map((u) => (
            <TouchableOpacity
              key={u.id}
              style={s.userRow}
              onPress={() => startOnboarding(u.id)}
              disabled={saving}
            >
              <View style={s.avatar}>
                <Text style={s.avatarText}>
                  {u.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardName}>{u.name}</Text>
                <Text style={s.cardMeta}>{u.email}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </WebModal>

    </SafeAreaView>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  loader: { flex: 1, backgroundColor: c.bg, justifyContent: "center", alignItems: "center" },
  popup: { position: "absolute", top: 60, left: 20, right: 20, padding: 14, borderRadius: 14, zIndex: 999 },
  popupOk: { backgroundColor: "#16a34a" },
  popupErr: { backgroundColor: "#dc2626" },
  popupText: { color: c.text, fontWeight: "700", textAlign: "center" },

  header: { flexDirection: "row", alignItems: "center", marginBottom: 18, marginTop: 10, gap: 12 },
  backBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: c.surface, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: c.surfaceBorder },
  addBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: c.accent, justifyContent: "center", alignItems: "center" },
  title: { color: c.text, fontSize: 24, fontWeight: "800" },
  subtitle: { color: c.textMuted, fontSize: 13, marginTop: 3 },

  empty: { padding: 40, backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.surfaceBorder, alignItems: "center" },
  emptyTitle: { color: c.text, fontSize: 16, fontWeight: "700" },
  emptySub: { color: c.textMuted, fontSize: 13, marginTop: 6, textAlign: "center" },

  card: { flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: c.surfaceBorder, gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.accent, justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  cardName: { color: c.text, fontSize: 14, fontWeight: "700" },
  cardMeta: { color: c.textMuted, fontSize: 11, marginTop: 2 },

  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(29,24,56,0.35)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: c.surface, borderRadius: 18, padding: 20, maxHeight: "80%" },
  modalTitle: { color: c.text, fontSize: 22, fontWeight: "800" },
  hint: { color: c.textMuted, fontSize: 12, marginTop: 4 },

  userRow: { flexDirection: "row", alignItems: "center", padding: 10, gap: 10, borderRadius: 10, backgroundColor: c.surfaceMuted, marginBottom: 6 },

  modalActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  cancelBtn: { flex: 1, backgroundColor: c.surfaceMuted, padding: 14, borderRadius: 12, alignItems: "center" },
  modalBtnText: { color: c.text, fontWeight: "700" } });
