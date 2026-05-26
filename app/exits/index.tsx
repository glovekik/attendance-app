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

import { hrListExits } from "../../src/services/exit";

import { ExitRequest, ExitStatus } from "../../src/types";

import { useTheme } from "../../src/theme/ThemeProvider";
const FILTERS: (ExitStatus | "ALL")[] = [
  "ALL",
  "REQUESTED",
  "APPROVED",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED",
];

export default function HRExits() {

  const router = useRouter();

  const { theme } = useTheme();

  const c = theme.colors;

  const s = useMemo(() => makeStyles(c), [c]);

  const [items, setItems] = useState<ExitRequest[]>([]);
  const [filter, setFilter] = useState<ExitStatus | "ALL">("ALL");
  const [loading, setLoading] = useState(true);

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
      const res = await hrListExits(
        token,
        filter === "ALL" ? undefined : filter
      );
      setItems(res || []);
    } catch (err: any) {
      showPopup(err?.message || "Failed to load", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [filter]);

  const statusTone = (st: ExitStatus): { bg: string; fg: string } => {
    switch (st) {
      case "REQUESTED": return { bg: c.warningBg, fg: c.warningText };
      case "APPROVED": return { bg: c.accentSoft, fg: c.accentText };
      case "IN_PROGRESS": return { bg: c.infoBg, fg: c.infoText };
      case "COMPLETED": return { bg: c.successBg, fg: c.successText };
      case "REJECTED": return { bg: c.dangerBg, fg: c.dangerText };
    }
  };

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
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
            <Text style={s.title}>Exits</Text>
            <Text style={s.subtitle}>{items.length} records</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterRow}
        >
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                s.filterBtn,
                filter === f && s.filterActive,
              ]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  s.filterText,
                  filter === f && { color: "#fff" },
                ]}
              >
                {f.replace("_", " ")}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {items.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>No matching exits</Text>
          </View>
        )}

        {items.map((e) => {
          // Backend sometimes returns the exit with a stale/null user
          // (deleted account, missing name). Show whatever we can:
          // name → email local-part → "Employee <last-6-of-id>".
          const displayName =
            e.user?.name ||
            (e.user?.email ? e.user.email.split("@")[0] : null) ||
            (e.userId
              ? `Employee ${e.userId.slice(-6)}`
              : "Unknown employee");
          const initial = displayName.charAt(0).toUpperCase();
          return (
          <TouchableOpacity
            key={e.id}
            style={s.card}
            onPress={() => router.push(`/exits/${e.id}`)}
            activeOpacity={0.85}
          >
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardName}>{displayName}</Text>
              {!!e.user?.email && (
                <Text style={s.cardMeta} numberOfLines={1}>
                  {e.user.email}
                </Text>
              )}
              <Text style={s.cardMeta}>
                Last day:{" "}
                {e.approvedLastWorkingDay ||
                  e.requestedLastWorkingDay}
              </Text>
            </View>
            {(() => {
              const tone = statusTone(e.status);
              return (
                <View
                  style={[s.statusChip, { backgroundColor: tone.bg }]}
                >
                  <Text style={[s.statusText, { color: tone.fg }]}>
                    {e.status.replace("_", " ")}
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

  header: { flexDirection: "row", alignItems: "center", marginBottom: 12, marginTop: 10, gap: 12 },
  backBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: c.surface, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: c.surfaceBorder },
  title: { color: c.text, fontSize: 24, fontWeight: "800" },
  subtitle: { color: c.textMuted, fontSize: 13, marginTop: 3 },

  filterRow: { gap: 6, paddingBottom: 14 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: c.surface, borderRadius: 999, borderWidth: 1, borderColor: c.surfaceBorder },
  filterActive: { backgroundColor: c.accent, borderColor: c.accent },
  filterText: { color: c.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },

  empty: { padding: 30, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.surfaceBorder, alignItems: "center" },
  emptyTitle: { color: c.text, fontSize: 15, fontWeight: "700" },

  card: { flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: c.surfaceBorder, gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.accent, justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  cardName: { color: c.text, fontSize: 14, fontWeight: "700" },
  cardMeta: { color: c.textMuted, fontSize: 11, marginTop: 2 },

  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 } });
