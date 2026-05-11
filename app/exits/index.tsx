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
  ActivityIndicator,
  SafeAreaView,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import { hrListExits } from "../../src/services/exit";

import { ExitRequest, ExitStatus } from "../../src/types";

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

  const [items, setItems] = useState<ExitRequest[]>([]);
  const [filter, setFilter] = useState<ExitStatus | "ALL">("ALL");
  const [loading, setLoading] = useState(true);

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

  const statusBg = (s: ExitStatus) => {
    switch (s) {
      case "REQUESTED": return "#f59e0b";
      case "APPROVED": return "#2563eb";
      case "IN_PROGRESS": return "#0d9488";
      case "COMPLETED": return "#16a34a";
      case "REJECTED": return "#dc2626";
    }
  };

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color="#2563eb" />
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
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
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

        {items.map((e) => (
          <TouchableOpacity
            key={e.id}
            style={s.card}
            onPress={() => router.push(`/exits/${e.id}`)}
            activeOpacity={0.85}
          >
            <View style={s.avatar}>
              <Text style={s.avatarText}>
                {(e.user?.name || "U").charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardName}>
                {e.user?.name || "User"}
              </Text>
              <Text style={s.cardMeta}>
                Last day:{" "}
                {e.approvedLastWorkingDay ||
                  e.requestedLastWorkingDay}
              </Text>
            </View>
            <View
              style={[
                s.statusChip,
                { backgroundColor: statusBg(e.status) },
              ]}
            >
              <Text style={s.statusText}>
                {e.status.replace("_", " ")}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color="#64748b"
            />
          </TouchableOpacity>
        ))}

      </ScrollView>

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

  header: { flexDirection: "row", alignItems: "center", marginBottom: 12, marginTop: 10, gap: 12 },
  backBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#111827", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#1f2937" },
  title: { color: "#fff", fontSize: 24, fontWeight: "800" },
  subtitle: { color: "#94a3b8", fontSize: 13, marginTop: 3 },

  filterRow: { gap: 6, paddingBottom: 14 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "#111827", borderRadius: 999, borderWidth: 1, borderColor: "#1f2937" },
  filterActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  filterText: { color: "#94a3b8", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },

  empty: { padding: 30, backgroundColor: "#111827", borderRadius: 14, borderWidth: 1, borderColor: "#1f2937", alignItems: "center" },
  emptyTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },

  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#111827", borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#1f2937", gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#2563eb", justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  cardName: { color: "#fff", fontSize: 14, fontWeight: "700" },
  cardMeta: { color: "#94a3b8", fontSize: 11, marginTop: 2 },

  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusText: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
});
