import React, {
  useEffect,
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  SafeAreaView,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  getMyOnboarding,
  uploadOnboardingDocument,
  setMyTaskStatus,
} from "../src/services/onboarding";

import {
  Onboarding,
  OnboardingDocument,
  OnboardingTask,
} from "../src/types";

export default function MyOnboarding() {

  const router = useRouter();

  const [data, setData] = useState<Onboarding | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [uploadVisible, setUploadVisible] = useState(false);
  const [target, setTarget] = useState<OnboardingDocument | null>(null);
  const [fileUrl, setFileUrl] = useState("");

  const [popup, setPopup] = useState({
    visible: false,
    type: "success" as "success" | "error",
    message: "",
  });

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
      const updated = await uploadOnboardingDocument(token, {
        documentId: target.id,
        fileUrl: fileUrl.trim(),
      });
      setData(updated);
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
      const updated = await setMyTaskStatus(token, {
        taskId: t.id,
        status: newStatus,
      });
      setData(updated);
    } catch (err: any) {
      showPopup(err?.message || "Failed to update", "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>My Onboarding</Text>
          </View>
        </View>
        <View style={s.empty}>
          <Ionicons name="time-outline" size={48} color="#475569" />
          <Text style={s.emptyTitle}>Not started yet</Text>
          <Text style={s.emptySub}>
            HR hasn't kicked off your onboarding. Check back later.
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
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>My Onboarding</Text>
            <Text style={s.subtitle}>
              Welcome — let's get you set up
            </Text>
          </View>
          <View
            style={[
              s.statusChip,
              data.status === "COMPLETED" && {
                backgroundColor: "#16a34a",
              },
              data.status === "IN_PROGRESS" && {
                backgroundColor: "#2563eb",
              },
              data.status === "PENDING" && {
                backgroundColor: "#f59e0b",
              },
            ]}
          >
            <Text style={s.statusText}>
              {data.status.replace("_", " ")}
            </Text>
          </View>
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
                  color="#16a34a"
                />
              )}
            </View>
          );
        })}

        {/* MY TASKS */}
        <Text style={[s.section, { marginTop: 18 }]}>
          YOUR TASKS
        </Text>
        {data.employeeTasks.map((t) => {
          const done = t.status === "DONE";
          return (
            <TouchableOpacity
              key={t.id}
              style={[s.card, done && { opacity: 0.6 }]}
              onPress={() => toggleTask(t)}
              activeOpacity={0.85}
              disabled={busy}
            >
              <Ionicons
                name={done ? "checkmark-circle" : "ellipse-outline"}
                size={22}
                color={done ? "#16a34a" : "#475569"}
              />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text
                  style={[
                    s.cardTitle,
                    done && {
                      textDecorationLine: "line-through",
                      color: "#94a3b8",
                    },
                  ]}
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

        {/* HR TASKS (read-only) */}
        <Text style={[s.section, { marginTop: 18 }]}>
          HR IS HANDLING
        </Text>
        {data.hrTasks.map((t) => {
          const done = t.status === "DONE";
          return (
            <View key={t.id} style={[s.card, { opacity: 0.7 }]}>
              <Ionicons
                name={done ? "checkmark-circle-outline" : "time-outline"}
                size={20}
                color={done ? "#16a34a" : "#94a3b8"}
              />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={s.cardTitle}>{t.title}</Text>
                <Text style={s.cardMeta}>{t.status}</Text>
              </View>
            </View>
          );
        })}

      </ScrollView>

      <Modal
        visible={uploadVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setUploadVisible(false)}
      >
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
              placeholderTextColor="#64748b"
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
                <Text style={s.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.saveBtn, busy && { opacity: 0.7 }]}
                onPress={submitUpload}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.modalBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b1220" },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  loader: { flex: 1, backgroundColor: "#0b1220", justifyContent: "center", alignItems: "center" },
  popup: { position: "absolute", top: 60, left: 20, right: 20, padding: 14, borderRadius: 14, zIndex: 999 },
  popupOk: { backgroundColor: "#16a34a" },
  popupErr: { backgroundColor: "#dc2626" },
  popupText: { color: "#fff", fontWeight: "700", textAlign: "center" },

  header: { flexDirection: "row", alignItems: "center", marginBottom: 14, marginTop: 10, gap: 12, padding: 20 },
  backBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#111827", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#1f2937" },
  title: { color: "#fff", fontSize: 24, fontWeight: "800" },
  subtitle: { color: "#94a3b8", fontSize: 13, marginTop: 3 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },

  section: { color: "#64748b", fontSize: 12, letterSpacing: 1.5, fontWeight: "700", marginBottom: 10 },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1f2937",
    gap: 10,
  },
  cardTitle: { color: "#fff", fontSize: 14, fontWeight: "700" },
  cardMeta: { color: "#94a3b8", fontSize: 11, marginTop: 3 },

  uploadBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#2563eb", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 4 },
  uploadText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  empty: { padding: 40, backgroundColor: "#111827", borderRadius: 18, borderWidth: 1, borderColor: "#1f2937", alignItems: "center", marginHorizontal: 20 },
  emptyTitle: { color: "#fff", fontSize: 17, fontWeight: "700", marginTop: 14 },
  emptySub: { color: "#94a3b8", fontSize: 13, marginTop: 6, textAlign: "center" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: "#111827", borderRadius: 18, padding: 20 },
  modalTitle: { color: "#fff", fontSize: 22, fontWeight: "800" },
  hint: { color: "#94a3b8", fontSize: 12, marginTop: 4, marginBottom: 8 },
  label: { color: "#94a3b8", fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: "#0f172a", color: "#fff", borderRadius: 12, padding: 13, borderWidth: 1, borderColor: "#1e293b", fontSize: 14 },
  fineprint: { color: "#64748b", fontSize: 11, marginTop: 6, fontStyle: "italic" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 22 },
  cancelBtn: { flex: 1, backgroundColor: "#374151", padding: 14, borderRadius: 12, alignItems: "center" },
  saveBtn: { flex: 1, backgroundColor: "#16a34a", padding: 14, borderRadius: 12, alignItems: "center" },
  modalBtnText: { color: "#fff", fontWeight: "700" },
});
