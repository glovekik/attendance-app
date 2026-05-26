import React, {
  useEffect,
  useState, useMemo} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Alert,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  useRouter,
  useLocalSearchParams,
} from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../src/theme/ThemeProvider";
import {
  hrGetOnboarding,
  hrSendWelcomeEmail,
  hrSetDocumentStatus,
  hrSetHRTaskStatus,
  hrCompleteOnboarding,
} from "../../src/services/onboarding";

import {
  Onboarding,
  OnboardingDocument,
  OnboardingTask,
} from "../../src/types";

export default function HROnboardingDetail() {

  const router = useRouter();

  const { theme } = useTheme();

  const c = theme.colors;

  const s = useMemo(() => makeStyles(c), [c]);
  const params = useLocalSearchParams();
  const id = params.id as string;

  const [data, setData] = useState<Onboarding | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

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
      const res = await hrGetOnboarding(token, id);
      setData(res);
    } catch (err: any) {
      showPopup(err?.message || "Failed to load", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [id]);

  const sendWelcome = async () => {
    if (!data || busy) return;
    try {
      setBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrSendWelcomeEmail(token, data.id);
      showPopup("Welcome email sent");
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed to send", "error");
    } finally {
      setBusy(false);
    }
  };

  const verifyDoc = async (doc: OnboardingDocument) => {
    if (!data || busy) return;
    try {
      setBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const newStatus =
        doc.status === "VERIFIED" ? "UPLOADED" : "VERIFIED";
      const updated = await hrSetDocumentStatus(token, data.id, {
        documentId: doc.id,
        status: newStatus,
      });
      setData(updated);
    } catch (err: any) {
      showPopup(err?.message || "Failed to update", "error");
    } finally {
      setBusy(false);
    }
  };

  const rejectDoc = async (doc: OnboardingDocument) => {
    if (!data || busy) return;
    try {
      setBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const updated = await hrSetDocumentStatus(token, data.id, {
        documentId: doc.id,
        status: "REJECTED",
      });
      setData(updated);
      showPopup("Document marked rejected");
    } catch (err: any) {
      showPopup(err?.message || "Failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const toggleHRTask = async (t: OnboardingTask) => {
    if (!data || busy) return;
    try {
      setBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const newStatus = t.status === "DONE" ? "PENDING" : "DONE";
      const updated = await hrSetHRTaskStatus(token, data.id, {
        taskId: t.id,
        status: newStatus,
      });
      setData(updated);
    } catch (err: any) {
      showPopup(err?.message || "Failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const completeAll = async () => {
    if (!data || busy) return;

    const ask = (msg: string): Promise<boolean> => {
      if (Platform.OS === "web") {
        return Promise.resolve(
          typeof window !== "undefined" && window.confirm(msg)
        );
      }
      return new Promise((resolve) => {
        Alert.alert("Complete onboarding?", msg, [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          { text: "Complete", onPress: () => resolve(true) },
        ]);
      });
    };

    const ok = await ask(
      "Mark this onboarding as complete? The status will flip to COMPLETED."
    );
    if (!ok) return;

    try {
      setBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrCompleteOnboarding(token, data.id);
      showPopup("Onboarding completed");
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed", "error");
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
      <View style={s.loader}>
        <Text style={{ color: c.text }}>Not found</Text>
      </View>
    );
  }

  const docStatusColor = (st: string) => {
    if (st === "VERIFIED") return "#16a34a";
    if (st === "UPLOADED") return "#2563eb";
    if (st === "REJECTED") return "#dc2626";
    return "#94a3b8";
  };

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
            <Text style={s.title}>
              {data.user?.name || "User"}
            </Text>
            <Text style={s.subtitle}>{data.user?.email}</Text>
          </View>
          <View
            style={[
              s.statusChip,
              data.status === "COMPLETED" && {
                backgroundColor: "#16a34a",
              },
              data.status === "IN_PROGRESS" && {
                backgroundColor: c.accent,
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

        {/* WELCOME EMAIL */}
        <View style={s.card}>
          <Ionicons
            name="mail-outline"
            size={20}
            color={c.textMuted}
          />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={s.cardName}>Welcome Email</Text>
            <Text style={s.cardMeta}>
              {data.welcomeEmailSent
                ? `Sent ${
                    data.welcomeEmailSentAt
                      ? new Date(
                          data.welcomeEmailSentAt
                        ).toLocaleDateString()
                      : ""
                  }`
                : "Not sent yet"}
            </Text>
          </View>
          {!data.welcomeEmailSent && (
            <TouchableOpacity
              style={s.sendBtn}
              onPress={sendWelcome}
              disabled={busy}
            >
              <Text style={s.sendText}>Send</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* DOCUMENTS */}
        <Text style={[s.section, { marginTop: 14 }]}>
          DOCUMENTS
        </Text>
        {data.documents.map((d) => (
          <View key={d.id} style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardName}>{d.title}</Text>
              <Text style={s.cardMeta}>
                {d.required ? "Required" : "Optional"}
                {"  ·  "}
                <Text style={{ color: docStatusColor(d.status) }}>
                  {d.status}
                </Text>
                {d.fileUrl ? "  ·  uploaded" : ""}
              </Text>
              {d.fileUrl ? (
                <Text
                  style={s.linkText}
                  numberOfLines={1}
                >
                  {d.fileUrl}
                </Text>
              ) : null}
            </View>
            {d.fileUrl && (
              <View style={s.actionsCol}>
                <TouchableOpacity
                  style={s.smallBtn}
                  onPress={() => verifyDoc(d)}
                  disabled={busy}
                >
                  <Ionicons
                    name={
                      d.status === "VERIFIED"
                        ? "close-circle-outline"
                        : "checkmark-circle-outline"
                    }
                    size={14}
                    color="#fff"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    s.smallBtn,
                    { backgroundColor: "#dc2626" },
                  ]}
                  onPress={() => rejectDoc(d)}
                  disabled={busy}
                >
                  <Ionicons
                    name="close-outline"
                    size={14}
                    color={c.text}
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        {/* HR TASKS */}
        <Text style={[s.section, { marginTop: 14 }]}>
          HR TASKS
        </Text>
        {data.hrTasks.map((t) => {
          const done = t.status === "DONE";
          return (
            <TouchableOpacity
              key={t.id}
              style={[s.card, done && { opacity: 0.6 }]}
              onPress={() => toggleHRTask(t)}
              disabled={busy}
              activeOpacity={0.85}
            >
              <Ionicons
                name={done ? "checkmark-circle" : "ellipse-outline"}
                size={22}
                color={done ? "#16a34a" : "#475569"}
              />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text
                  style={[
                    s.cardName,
                    done && {
                      textDecorationLine: "line-through",
                      color: c.textMuted,
                    },
                  ]}
                >
                  {t.title}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* EMPLOYEE TASKS (read-only) */}
        <Text style={[s.section, { marginTop: 14 }]}>
          EMPLOYEE TASKS (read-only)
        </Text>
        {data.employeeTasks.map((t) => {
          const done = t.status === "DONE";
          return (
            <View
              key={t.id}
              style={[s.card, { opacity: 0.7 }]}
            >
              <Ionicons
                name={done ? "checkmark-circle-outline" : "time-outline"}
                size={20}
                color={done ? "#16a34a" : "#94a3b8"}
              />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={s.cardName}>{t.title}</Text>
                <Text style={s.cardMeta}>{t.status}</Text>
              </View>
            </View>
          );
        })}

        {/* COMPLETE */}
        {data.status !== "COMPLETED" && (
          <TouchableOpacity
            style={[s.completeBtn, busy && { opacity: 0.7 }]}
            onPress={completeAll}
            disabled={busy}
          >
            <Ionicons
              name="flag-outline"
              size={18}
              color="#fff"
            />
            <Text style={s.completeText}>
              Mark Onboarding Complete
            </Text>
          </TouchableOpacity>
        )}

      </ScrollView>

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

  header: { flexDirection: "row", alignItems: "center", marginBottom: 14, marginTop: 10, gap: 12 },
  backBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: c.surface, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: c.surfaceBorder },
  title: { color: c.text, fontSize: 22, fontWeight: "800" },
  subtitle: { color: c.textMuted, fontSize: 12, marginTop: 3 },

  statusChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  statusText: { color: c.text, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },

  section: { color: c.textMuted, fontSize: 12, letterSpacing: 1.5, fontWeight: "700", marginBottom: 10 },

  card: { flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: c.surfaceBorder, gap: 10 },
  cardName: { color: c.text, fontSize: 14, fontWeight: "700" },
  cardMeta: { color: c.textMuted, fontSize: 11, marginTop: 3 },
  linkText: { color: "#60a5fa", fontSize: 11, marginTop: 4 },

  sendBtn: { backgroundColor: c.accent, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  sendText: { color: c.text, fontWeight: "700", fontSize: 12 },

  actionsCol: { flexDirection: "column", gap: 5 },
  smallBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: "#16a34a", justifyContent: "center", alignItems: "center" },

  completeBtn: { marginTop: 22, backgroundColor: "#16a34a", paddingVertical: 14, borderRadius: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  completeText: { color: c.text, fontWeight: "700", fontSize: 15 },
});
