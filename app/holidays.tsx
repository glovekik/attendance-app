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
  Platform,
  Alert,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import DateTimePicker from "@react-native-community/datetimepicker";

import {
  WebDateField,
  dateToYMD,
  ymdToDate,
} from "../src/components/WebDateField";

import {
  listHolidays,
  hrCreateHoliday,
  hrUpdateHoliday,
  hrDeleteHoliday,
} from "../src/services/holidays";

import { getMe } from "../src/services/api";

import { Holiday, hasRole, User } from "../src/types";

const isWeb = Platform.OS === "web";

export default function Holidays() {

  const router = useRouter();

  const now = new Date();

  const [me, setMe] = useState<User | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [items, setItems] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

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

  const isHR = hasRole(me, "HR");

  const load = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const [meRes, list] = await Promise.all([
        getMe(token),
        listHolidays(token, { year }),
      ]);
      setMe(meRes);
      setItems(list || []);
    } catch (err: any) {
      showPopup(err?.message || "Failed to load", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [year]);

  const reset = () => {
    setEditingId(null);
    setDate(new Date());
    setName("");
    setDescription("");
  };

  const openCreate = () => {
    reset();
    setModalVisible(true);
  };

  const openEdit = (h: Holiday) => {
    if (!isHR) return;
    setEditingId(h.id);
    setDate(new Date(`${h.date}T00:00:00`));
    setName(h.name);
    setDescription(h.description || "");
    setModalVisible(true);
  };

  const submit = async () => {
    if (saving) return;
    if (!name.trim()) {
      showPopup("Name required", "error");
      return;
    }
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const payload = {
        date: dateToYMD(date),
        name: name.trim(),
        description: description.trim() || undefined,
      };
      if (editingId) {
        await hrUpdateHoliday(token, editingId, payload);
        showPopup("Holiday updated");
      } else {
        await hrCreateHoliday(token, payload);
        showPopup("Holiday added");
      }
      setModalVisible(false);
      reset();
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (h: Holiday) => {
    if (!isHR) return;
    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.confirm(`Delete "${h.name}"?`)
      ) {
        doDelete(h.id);
      }
      return;
    }
    Alert.alert("Delete holiday?", h.name, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => doDelete(h.id),
      },
    ]);
  };

  const doDelete = async (id: string) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrDeleteHoliday(token, id);
      showPopup("Deleted");
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed", "error");
    }
  };

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // Group by month for display
  const byMonth = new Map<number, Holiday[]>();
  items.forEach((h) => {
    const m = new Date(`${h.date}T00:00:00`).getMonth();
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m)!.push(h);
  });

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

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
            <Text style={s.title}>Holiday Calendar</Text>
            <Text style={s.subtitle}>
              {items.length} holidays in {year}
            </Text>
          </View>
          {isHR && (
            <TouchableOpacity
              style={s.addBtn}
              onPress={openCreate}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* YEAR NAV */}
        <View style={s.yearNav}>
          <TouchableOpacity onPress={() => setYear(year - 1)}>
            <Ionicons
              name="chevron-back"
              size={20}
              color="#94a3b8"
            />
          </TouchableOpacity>
          <Text style={s.yearLabel}>{year}</Text>
          <TouchableOpacity onPress={() => setYear(year + 1)}>
            <Ionicons
              name="chevron-forward"
              size={20}
              color="#94a3b8"
            />
          </TouchableOpacity>
        </View>

        {items.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>No holidays for {year}</Text>
            <Text style={s.emptySub}>
              {isHR
                ? "Tap + to add the first one."
                : "HR hasn't published holidays yet."}
            </Text>
          </View>
        )}

        {Array.from(byMonth.keys())
          .sort((a, b) => a - b)
          .map((m) => (
            <View key={m} style={{ marginBottom: 14 }}>
              <Text style={s.monthLabel}>
                {monthNames[m].toUpperCase()}
              </Text>
              {byMonth
                .get(m)!
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((h) => {
                  const d = new Date(`${h.date}T00:00:00`);
                  const day = d.getDate();
                  const weekday = d.toLocaleDateString("en-US", {
                    weekday: "short",
                  });
                  return (
                    <TouchableOpacity
                      key={h.id}
                      style={s.row}
                      onPress={() => isHR && openEdit(h)}
                      onLongPress={() => askDelete(h)}
                      activeOpacity={isHR ? 0.85 : 1}
                    >
                      <View style={s.dateBox}>
                        <Text style={s.dayNum}>{day}</Text>
                        <Text style={s.weekday}>
                          {weekday}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.rowName}>{h.name}</Text>
                        {h.description ? (
                          <Text style={s.rowDesc}>
                            {h.description}
                          </Text>
                        ) : null}
                      </View>
                      {isHR && (
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color="#64748b"
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
            </View>
          ))}

      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <ScrollView>

              <Text style={s.modalTitle}>
                {editingId ? "Edit Holiday" : "New Holiday"}
              </Text>

              <Text style={s.label}>Date</Text>
              {isWeb ? (
                <View style={s.dateRow}>
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color="#94a3b8"
                  />
                  <WebDateField
                    mode="date"
                    value={dateToYMD(date)}
                    onChange={(v) => {
                      const d = ymdToDate(v);
                      if (d) setDate(d);
                    }}
                  />
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={s.dateRow}
                    onPress={() => setShowPicker(true)}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color="#94a3b8"
                    />
                    <Text style={s.dateText}>
                      {date.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Text>
                  </TouchableOpacity>
                  {showPicker && (
                    <DateTimePicker
                      value={date}
                      mode="date"
                      onChange={(_, d) => {
                        setShowPicker(Platform.OS === "ios");
                        if (d) setDate(d);
                      }}
                    />
                  )}
                </>
              )}

              <Text style={s.label}>Name</Text>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={setName}
                placeholder="Independence Day"
                placeholderTextColor="#64748b"
              />

              <Text style={s.label}>Description</Text>
              <TextInput
                style={[s.input, s.multi]}
                value={description}
                onChangeText={setDescription}
                placeholder="Optional"
                placeholderTextColor="#64748b"
                multiline
              />

              <View style={s.modalActions}>
                <TouchableOpacity
                  style={s.cancelBtn}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={s.modalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.saveBtn, saving && { opacity: 0.7 }]}
                  onPress={submit}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.modalBtnText}>
                      {editingId ? "Update" : "Add"}
                    </Text>
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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b1220" },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  loader: { flex: 1, backgroundColor: "#0b1220", justifyContent: "center", alignItems: "center" },
  popup: { position: "absolute", top: 60, left: 20, right: 20, padding: 14, borderRadius: 14, zIndex: 999 },
  popupOk: { backgroundColor: "#16a34a" },
  popupErr: { backgroundColor: "#dc2626" },
  popupText: { color: "#fff", fontWeight: "700", textAlign: "center" },

  header: { flexDirection: "row", alignItems: "center", marginBottom: 14, marginTop: 10, gap: 12 },
  backBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#111827", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#1f2937" },
  addBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#2563eb", justifyContent: "center", alignItems: "center" },
  title: { color: "#fff", fontSize: 24, fontWeight: "800" },
  subtitle: { color: "#94a3b8", fontSize: 13, marginTop: 3 },

  yearNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#111827",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    marginBottom: 16,
  },
  yearLabel: { color: "#fff", fontSize: 15, fontWeight: "800" },

  empty: { padding: 30, backgroundColor: "#111827", borderRadius: 14, borderWidth: 1, borderColor: "#1f2937", alignItems: "center" },
  emptyTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  emptySub: { color: "#94a3b8", fontSize: 12, marginTop: 4, textAlign: "center" },

  monthLabel: { color: "#64748b", fontSize: 11, fontWeight: "700", letterSpacing: 1.5, marginBottom: 8 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1f2937",
    gap: 12,
  },
  dateBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
  },
  dayNum: { color: "#fff", fontSize: 16, fontWeight: "800" },
  weekday: { color: "#64748b", fontSize: 9, fontWeight: "700" },
  rowName: { color: "#fff", fontSize: 14, fontWeight: "700" },
  rowDesc: { color: "#94a3b8", fontSize: 12, marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: "#111827", borderRadius: 18, padding: 20, maxHeight: "90%" },
  modalTitle: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 8 },

  label: { color: "#94a3b8", fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: "#0f172a", color: "#fff", borderRadius: 12, padding: 13, borderWidth: 1, borderColor: "#1e293b", fontSize: 14 },
  multi: { minHeight: 70, textAlignVertical: "top" },

  dateRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#0f172a", borderRadius: 12, padding: 13, borderWidth: 1, borderColor: "#1e293b", gap: 10 },
  dateText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  modalActions: { flexDirection: "row", gap: 10, marginTop: 22 },
  cancelBtn: { flex: 1, backgroundColor: "#374151", padding: 14, borderRadius: 12, alignItems: "center" },
  saveBtn: { flex: 1, backgroundColor: "#16a34a", padding: 14, borderRadius: 12, alignItems: "center" },
  modalBtnText: { color: "#fff", fontWeight: "700" },
});
