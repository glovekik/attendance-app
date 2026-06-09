import React, {
  useEffect,
  useState, useMemo} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../src/theme/ThemeProvider";
import {
  getMyOnboarding,
  uploadOnboardingDocument,
  setMyTaskStatus } from "../src/services/onboarding";

import {
  Onboarding,
  OnboardingDocument,
  OnboardingTask } from "../src/types";

export default function MyOnboarding() {

  const router = useRouter();

  const { theme } = useTheme();

  const c = theme.colors;

  const s = useMemo(() => makeStyles(c), [c]);

  const [data, setData] = useState<Onboarding | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [uploadVisible, setUploadVisible] = useState(false);
  const [target, setTarget] = useState<OnboardingDocument | null>(null);
  const [fileUrl, setFileUrl] = useState("");

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
      const res = await getMyOnboarding(token);
      setData(res);
    } catch (err: any) {
      showPopup(err?.message || "Failed to load", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openUpload = (doc: OnboardingDocument) => {
    setTarget(doc);
    setFileUrl(doc.fileUrl || "");
    setUploadVisible(true);
  };

  const submitUpload = async () => {
    if (!target || busy) return;
    if (!fileUrl.trim()) {
      showPopup("Paste a file URL", "error");
      return;
    }
    try {
      setBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await uploadOnboardingDocument(token, {
        documentId: target.id,
        fileUrl: fileUrl.trim() });
      // The endpoint returns only { message }; re-fetch for fresh state.
      setData(await getMyOnboarding(token));
      setUploadVisible(false);
      showPopup("Uploaded");
    } catch (err: any) {
      showPopup(err?.message || "Failed to upload", "error");
    } finally {
      setBusy(false);
    }
  };

  const toggleTask = async (t: OnboardingTask) => {
    if (busy) return;
    try {
      setBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const newStatus = t.status === "DONE" ? "PENDING" : "DONE";
      await setMyTaskStatus(token, {
        taskId: t.id,
        status: newStatus });
      // The endpoint returns only { message }; re-fetch for fresh state.
      setData(await getMyOnboarding(token));
    } catch (err: any) {
      showPopup(err?.message || "Failed to update", "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          >
            <Ionicons name="chevron-back" size={22} color={c.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>My Onboarding</Text>
          </View>
        </View>
        <View style={s.empty}>
          <Ionicons name="time-outline" size={48} color={c.textFaint} />
          <Text style={s.emptyTitle}>Not started yet</Text>
          <Text style={s.emptySub}>
            HR hasn&apos;t kicked off your onboarding. Check back later.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
            <Text style={s.title}>My Onboarding</Text>
            <Text style={s.subtitle}>
              Welcome — let&apos;s get you set up
            </Text>
          </View>
          {(() => {
            const tone =
              data.status === "COMPLETED"
                ? { bg: c.successBg, fg: c.successText }
                : data.status === "IN_PROGRESS"
                ? { bg: c.accentSoft, fg: c.accentText }
                : { bg: c.warningBg, fg: c.warningText };
            return (
              <View
                style={[s.statusChip, { backgroundColor: tone.bg }]}
              >
                <Text style={[s.statusText, { color: tone.fg }]}>
                  {data.status.replace("_", " ")}
                </Text>
              </View>
            );
          })()}
        </View>

        {/* DOCUMENTS */}
        <Text style={s.section}>DOCUMENTS</Text>
        {data.documents.map((d) => {
          const verified = d.status === "VERIFIED";
          const uploaded = !!d.fileUrl;
          return (
            <View key={d.id} style={s.card}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{d.title}</Text>
                <Text style={s.cardMeta}>
                  {d.required ? "Required" : "Optional"}
                  {"  ·  "}
                  {d.status}
                  {d.note ? `  ·  ${d.note}` : ""}
                </Text>
              </View>
              {!verified && (
                <TouchableOpacity
                  style={s.uploadBtn}
                  onPress={() => openUpload(d)}
                >
                  <Ionicons
                    name={uploaded ? "refresh-outline" : "cloud-upload-outline"}
                    size={14}
                    color="#fff"
                  />
                  <Text style={s.uploadText}>
                    {uploaded ? "Replace" : "Upload"}
                  </Text>
                </TouchableOpacity>
              )}
              {verified && (
                <Ionicons
                  name="checkmark-circle"
                  size={22}
                  color={c.successText}
                />
              )}
            </View>
          );
        })}

        {/* TASKS — tap a row to toggle it done. */}
        {data.employeeTasks.length > 0 && (
          <>
            <Text style={[s.section, { marginTop: 22 }]}>
              YOUR TASKS
            </Text>
            {data.employeeTasks.map((t) => {
              const done = t.status === "DONE";
              return (
                <TouchableOpacity
                  key={t.id}
                  style={s.card}
                  onPress={() => toggleTask(t)}
                  disabled={busy}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={done ? "checkmark-circle" : "ellipse-outline"}
                    size={24}
                    color={done ? c.successText : c.textFaint}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[s.cardTitle, done && s.cardTitleDone]}
                    >
                      {t.title}
                    </Text>
                    {t.note ? (
                      <Text style={s.cardMeta}>{t.note}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

      </ScrollView>

      <Modal
        visible={uploadVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setUploadVisible(false)}
      >
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Upload</Text>
            <Text style={s.hint}>{target?.title}</Text>

            <Text style={s.label}>File URL</Text>
            <TextInput
              style={s.input}
              value={fileUrl}
              onChangeText={setFileUrl}
              placeholder="https://drive.google.com/…"
              placeholderTextColor={c.textFaint}
              autoCapitalize="none"
            />
            <Text style={s.fineprint}>
              Upload your file to a sharable storage (Drive, Dropbox, etc.) and paste the URL here.
            </Text>

            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => setUploadVisible(false)}
              >
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.saveBtn, busy && { opacity: 0.7 }]}
                onPress={submitUpload}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
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
  loader: { flex: 1, backgroundColor: c.bg, justifyContent: "center", alignItems: "center" },
  popup: { position: "absolute", top: 60, left: 20, right: 20, padding: 14, borderRadius: 14, zIndex: 999 },
  popupOk: { backgroundColor: c.successText },
  popupErr: { backgroundColor: c.dangerText },
  popupText: { color: "#fff", fontWeight: "700", textAlign: "center" },

  header: { flexDirection: "row", alignItems: "center", marginBottom: 14, marginTop: 10, gap: 12, padding: 20 },
  backBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: c.surface, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: c.surfaceBorder },
  title: { color: c.text, fontSize: 24, fontWeight: "800" },
  subtitle: { color: c.textMuted, fontSize: 13, marginTop: 3 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },

  section: { color: c.textMuted, fontSize: 12, letterSpacing: 1.5, fontWeight: "700", marginBottom: 10 },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    gap: 10 },
  cardTitle: { color: c.text, fontSize: 14, fontWeight: "700" },
  cardTitleDone: { textDecorationLine: "line-through", color: c.textMuted },
  cardMeta: { color: c.textMuted, fontSize: 11, marginTop: 3 },

  uploadBtn: { flexDirection: "row", alignItems: "center", backgroundColor: c.accent, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 4 },
  uploadText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  empty: { padding: 40, backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.surfaceBorder, alignItems: "center", marginHorizontal: 20 },
  emptyTitle: { color: c.text, fontSize: 17, fontWeight: "700", marginTop: 14 },
  emptySub: { color: c.textMuted, fontSize: 13, marginTop: 6, textAlign: "center" },

  modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: c.surface, borderRadius: 18, padding: 20 },
  modalTitle: { color: c.text, fontSize: 22, fontWeight: "800" },
  hint: { color: c.textMuted, fontSize: 12, marginTop: 4, marginBottom: 8 },
  label: { color: c.textMuted, fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: c.surfaceMuted, color: c.text, borderRadius: 12, padding: 13, borderWidth: 1, borderColor: c.surfaceBorder, fontSize: 14 },
  fineprint: { color: c.textMuted, fontSize: 11, marginTop: 6, fontStyle: "italic" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 22 },
  cancelBtn: { flex: 1, backgroundColor: c.surfaceMuted, padding: 14, borderRadius: 12, alignItems: "center" },
  cancelBtnText: { color: c.text, fontWeight: "700" },
  saveBtn: { flex: 1, backgroundColor: c.accent, padding: 14, borderRadius: 12, alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "700" } });

