import React, {
  useEffect,
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
  Modal,
  RefreshControl,
  Platform,
  Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter, useFocusEffect } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import DateTimePicker from "@react-native-community/datetimepicker";

import { useTheme } from "../src/theme/ThemeProvider";
import {
  WebDateField,
  dateToYMD,
  dateToHM,
  ymdToDate,
  hmToDate } from "../src/components/WebDateField";

import {
  submitManualRequest,
  listMyManualRequests,
  cancelManualRequest,
  ManualAttendanceRequest,
  ManualRequestStatus } from "../src/services/manualAttendance";

const isWeb = Platform.OS === "web";

const TYPES = ["OFFICE", "WFH"];

const statusColor = (s: ManualRequestStatus) =>
  s === "APPROVED"
    ? "#16a34a"
    : s === "REJECTED"
    ? "#dc2626"
    : s === "CANCELLED"
    ? "#374151"
    : "#f59e0b";

export default function ManualRequest() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const s = useMemo(() => makeStyles(c), [c]);

  const [items, setItems] = useState<ManualAttendanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [date, setDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const [checkOutTime, setCheckOutTime] = useState<Date | null>(null);
  const [showIn, setShowIn] = useState(false);
  const [showOut, setShowOut] = useState(false);
  const [type, setType] = useState("OFFICE");
  const [reason, setReason] = useState("");

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

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const data = await listMyManualRequests(token);
      setItems(data || []);
    } catch (err: any) {
      Alert.alert(
        "Couldn't load requests",
        err?.message || "Pull down to retry."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openForm = () => {
    setDate(new Date());
    setCheckInTime(null);
    setCheckOutTime(null);
    setType("OFFICE");
    setReason("");
    setSubmitError(null);
    setModalVisible(true);
  };

  const combine = (d: Date, t: Date) => {
    const out = new Date(d);
    out.setHours(t.getHours(), t.getMinutes(), 0, 0);
    return out.toISOString();
  };

  const submit = async () => {
    if (saving) return;
    setSubmitError(null);

    if (!checkInTime) {
      setSubmitError("Pick check-in time");
      return;
    }
    if (!checkOutTime) {
      setSubmitError("Pick check-out time");
      return;
    }
    const inMins =
      checkInTime.getHours() * 60 + checkInTime.getMinutes();
    const outMins =
      checkOutTime.getHours() * 60 + checkOutTime.getMinutes();
    if (outMins <= inMins) {
      setSubmitError("Check-out must be after check-in");
      return;
    }
    if (!reason.trim()) {
      setSubmitError("Reason is required");
      return;
    }

    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await submitManualRequest(token, {
        date: dateToYMD(date),
        checkIn: combine(date, checkInTime),
        checkOut: combine(date, checkOutTime),
        attendanceType: type,
        reason: reason.trim() });
      showPopup("Request submitted");
      setModalVisible(false);
      await load();
    } catch (err: any) {
      setSubmitError(err?.message || "Failed to submit");
    } finally {
      setSaving(false);
    }
  };

  const askCancel = (r: ManualAttendanceRequest) => {
    const doCancel = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;
        await cancelManualRequest(token, r.id);
        showPopup("Cancelled");
        await load();
      } catch (err: any) {
        showPopup(err?.message || "Failed to cancel", "error");
      }
    };
    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.confirm("Cancel this request?")
      ) {
        doCancel();
      }
      return;
    }
    Alert.alert("Cancel request?", r.date, [
      { text: "Keep", style: "cancel" },
      { text: "Cancel", style: "destructive", onPress: doCancel },
    ]);
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={c.accent}
            colors={[c.accent]}
          />
        }
      >
        <View style={s.header}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          >
            <Ionicons name="chevron-back" size={22} color={c.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Manual Attendance</Text>
            <Text style={s.subtitle}>Request a missed day</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={openForm}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={s.infoBanner}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color="#60a5fa"
          />
          <Text style={s.infoBannerText}>
            Forgot to mark a day? Submit a request and your manager or HR
            will approve it. Don&apos;t use this for already-recorded days —
            request a correction from History instead.
          </Text>
        </View>

        {items.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="time-outline" size={42} color={c.textFaint} />
            <Text style={s.emptyTitle}>No requests yet</Text>
            <Text style={s.emptySub}>
              Tap + to request attendance for a missed day.
            </Text>
          </View>
        ) : (
          items.map((r) => (
            <View key={r.id} style={s.card}>
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardDate}>{r.date}</Text>
                  <Text style={s.cardSub}>
                    {r.attendanceType || "—"}
                    {r.checkIn
                      ? `  ·  ${new Date(r.checkIn).toLocaleTimeString(
                          [],
                          {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true }
                        )}`
                      : ""}
                    {r.checkOut
                      ? ` → ${new Date(r.checkOut).toLocaleTimeString(
                          [],
                          {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true }
                        )}`
                      : ""}
                  </Text>
                </View>
                <View
                  style={[
                    s.statusChip,
                    { backgroundColor: statusColor(r.status) },
                  ]}
                >
                  <Text style={s.statusText}>{r.status}</Text>
                </View>
              </View>
              <Text style={s.reasonLine}>{r.reason}</Text>
              {!!r.decisionNote && (
                <Text style={s.noteLine}>
                  {r.decidedByRole === "HR" ? "HR note: " : "Manager note: "}
                  {r.decisionNote}
                </Text>
              )}
              {r.status === "PENDING" && (
                <TouchableOpacity
                  style={s.cancelLine}
                  onPress={() => askCancel(r)}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={14}
                    color="#dc2626"
                  />
                  <Text style={s.cancelLineText}>Cancel request</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={s.modalTitle}>Request manual attendance</Text>

              <Text style={s.label}>Date</Text>
              {isWeb ? (
                <View style={s.row}>
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={c.textMuted}
                  />
                  <WebDateField
                    mode="date"
                    value={dateToYMD(date)}
                    max={dateToYMD(new Date())}
                    onChange={(v) => {
                      const d = ymdToDate(v);
                      if (d) setDate(d);
                    }}
                  />
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={s.row}
                    onPress={() => setShowDate(true)}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color={c.textMuted}
                    />
                    <Text style={s.rowText}>
                      {date.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric" })}
                    </Text>
                  </TouchableOpacity>
                  {showDate && (
                    <DateTimePicker
                      value={date}
                      mode="date"
                      maximumDate={new Date()}
                      onChange={(_, d) => {
                        setShowDate(Platform.OS === "ios");
                        if (d) setDate(d);
                      }}
                    />
                  )}
                </>
              )}

              <Text style={s.label}>Attendance type</Text>
              <View style={s.typeRow}>
                {TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      s.typeBtn,
                      type === t && s.typeBtnActive,
                    ]}
                    onPress={() => setType(t)}
                  >
                    <Text
                      style={[
                        s.typeText,
                        type === t && { color: "#fff" },
                      ]}
                    >
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Check in</Text>
              {isWeb ? (
                <View style={s.row}>
                  <Ionicons
                    name="log-in-outline"
                    size={18}
                    color="#16a34a"
                  />
                  <WebDateField
                    mode="time"
                    value={checkInTime ? dateToHM(checkInTime) : ""}
                    onChange={(v) => {
                      const d = hmToDate(v);
                      if (d) setCheckInTime(d);
                    }}
                  />
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={s.row}
                    onPress={() => setShowIn(true)}
                  >
                    <Ionicons
                      name="log-in-outline"
                      size={18}
                      color="#16a34a"
                    />
                    <Text style={s.rowText}>
                      {checkInTime
                        ? checkInTime.toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true })
                        : "Tap to set"}
                    </Text>
                  </TouchableOpacity>
                  {showIn && (
                    <DateTimePicker
                      value={checkInTime || new Date()}
                      mode="time"
                      onChange={(_, d) => {
                        setShowIn(Platform.OS === "ios");
                        if (d) setCheckInTime(d);
                      }}
                    />
                  )}
                </>
              )}

              <Text style={s.label}>Check out</Text>
              {isWeb ? (
                <View style={s.row}>
                  <Ionicons
                    name="log-out-outline"
                    size={18}
                    color="#dc2626"
                  />
                  <WebDateField
                    mode="time"
                    value={checkOutTime ? dateToHM(checkOutTime) : ""}
                    onChange={(v) => {
                      const d = hmToDate(v);
                      if (d) setCheckOutTime(d);
                    }}
                  />
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={s.row}
                    onPress={() => setShowOut(true)}
                  >
                    <Ionicons
                      name="log-out-outline"
                      size={18}
                      color="#dc2626"
                    />
                    <Text style={s.rowText}>
                      {checkOutTime
                        ? checkOutTime.toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true })
                        : "Tap to set"}
                    </Text>
                  </TouchableOpacity>
                  {showOut && (
                    <DateTimePicker
                      value={checkOutTime || new Date()}
                      mode="time"
                      onChange={(_, d) => {
                        setShowOut(Platform.OS === "ios");
                        if (d) setCheckOutTime(d);
                      }}
                    />
                  )}
                </>
              )}

              <Text style={s.label}>Reason</Text>
              <TextInput
                style={[s.input, { minHeight: 80 }]}
                value={reason}
                onChangeText={setReason}
                placeholder="Why are you submitting manually?"
                placeholderTextColor={c.textFaint}
                multiline
              />

              {submitError && (
                <View style={s.inlineError}>
                  <Ionicons
                    name="alert-circle"
                    size={14}
                    color="#fca5a5"
                  />
                  <Text style={s.inlineErrorText}>{submitError}</Text>
                </View>
              )}

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
                    <Text style={[s.modalBtnText, { color: "#fff" }]}>Submit</Text>
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
  content: { padding: 16, paddingBottom: 60 },
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
  popupOk: { backgroundColor: "#16a34a" },
  popupErr: { backgroundColor: "#dc2626" },
  popupText: { color: c.text, fontWeight: "700", textAlign: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    marginTop: 4,
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
  title: { color: c.text, fontSize: 22, fontWeight: "800" },
  subtitle: { color: c.textMuted, fontSize: 12, marginTop: 3 },

  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(96,165,250,0.1)",
    borderColor: "rgba(96,165,250,0.35)",
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 14 },
  infoBannerText: {
    color: "#bfdbfe",
    fontSize: 12,
    lineHeight: 17,
    flex: 1 },

  empty: {
    alignItems: "center",
    padding: 40,
    backgroundColor: c.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    gap: 8 },
  emptyTitle: { color: c.text, fontSize: 16, fontWeight: "700" },
  emptySub: {
    color: c.textMuted,
    fontSize: 12,
    textAlign: "center" },

  card: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10 },
  cardDate: { color: c.text, fontSize: 15, fontWeight: "800" },
  cardSub: { color: c.textMuted, fontSize: 12, marginTop: 3 },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999 },
  statusText: {
    color: c.text,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5 },
  reasonLine: {
    color: c.text,
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18 },
  noteLine: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 6,
    fontStyle: "italic" },
  cancelLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
    alignSelf: "flex-start" },
  cancelLineText: {
    color: "#dc2626",
    fontSize: 12,
    fontWeight: "700" },

  modalOverlay: {
    flex: 1,
    backgroundColor: c.overlay,
    justifyContent: "center",
    padding: 20 },
  modalCard: {
    backgroundColor: c.surface,
    borderRadius: 18,
    padding: 20,
    maxHeight: "92%" },
  modalTitle: { color: c.text, fontSize: 20, fontWeight: "800" },
  label: {
    color: c.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 14,
    marginBottom: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surfaceMuted,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    gap: 10 },
  rowText: { color: c.text, fontWeight: "700", fontSize: 14 },
  typeRow: { flexDirection: "row", gap: 6 },
  typeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  typeBtnActive: {
    backgroundColor: c.accent,
    borderColor: c.accent },
  typeText: { color: c.textMuted, fontWeight: "700", fontSize: 12 },
  input: {
    backgroundColor: c.surfaceMuted,
    color: c.text,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    fontSize: 14,
    textAlignVertical: "top" },
  inlineError: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(220,38,38,0.12)",
    borderColor: "rgba(220,38,38,0.4)",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 6,
    marginTop: 14 },
  inlineErrorText: {
    color: "#fca5a5",
    fontSize: 13,
    fontWeight: "600",
    flex: 1 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  cancelBtn: {
    flex: 1,
    backgroundColor: c.surfaceMuted,
    padding: 13,
    borderRadius: 11,
    alignItems: "center" },
  saveBtn: {
    flex: 1,
    backgroundColor: "#16a34a",
    padding: 13,
    borderRadius: 11,
    alignItems: "center" },
  modalBtnText: { color: c.text, fontWeight: "700" } });

