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
  Switch,
  Platform,
  Alert,
  RefreshControl,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter, useFocusEffect } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import DateTimePicker from "@react-native-community/datetimepicker";

import {
  WebDateField,
  dateToYMD,
  ymdToDate,
} from "../src/components/WebDateField";

import {
  listLeaveTypes,
  getLeaveBalance,
  submitLeaveRequest,
  listMyLeaves,
  cancelLeaveRequest,
} from "../src/services/leaves";

import {
  LeaveType,
  LeaveBalance,
  LeaveRequest,
  HalfDayPart,
} from "../src/types";

const isWeb = Platform.OS === "web";

export default function MyLeaves() {

  const router = useRouter();

  const [types, setTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [mine, setMine] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [popup, setPopup] = useState({
    visible: false,
    type: "success" as "success" | "error",
    message: "",
  });

  // ===== request modal =====
  const [modalVisible, setModalVisible] = useState(false);
  const [typeCode, setTypeCode] = useState("");
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [showFrom, setShowFrom] = useState(false);
  const [showTo, setShowTo] = useState(false);
  const [reason, setReason] = useState("");
  const [halfDay, setHalfDay] = useState(false);
  const [halfDayPart, setHalfDayPart] =
    useState<HalfDayPart>("FIRST");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [saving, setSaving] = useState(false);

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
      const [t, b, m] = await Promise.all([
        listLeaveTypes(token),
        getLeaveBalance(token),
        listMyLeaves(token),
      ]);
      setTypes(t || []);
      setBalances(b || []);
      setMine(m || []);
    } catch (err: any) {
      showPopup(err?.message || "Failed to load", "error");
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Refresh balances each time the screen regains focus — covers the
  // case where HR allocates/adjusts leave while the screen was stale.
  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const openRequest = () => {
    if (types.length === 0) {
      showPopup("No leave types configured", "error");
      return;
    }
    setTypeCode(types[0].code);
    const today = new Date();
    setFromDate(today);
    setToDate(today);
    setReason("");
    setHalfDay(false);
    setHalfDayPart("FIRST");
    setAttachmentUrl("");
    setModalVisible(true);
  };

  const selectedType = types.find((t) => t.code === typeCode);

  const submit = async () => {

    if (saving) return;

    if (!typeCode) {
      showPopup("Pick a leave type", "error");
      return;
    }
    if (!reason.trim()) {
      showPopup("Reason required", "error");
      return;
    }
    if (
      selectedType?.requiresAttachment &&
      !attachmentUrl.trim()
    ) {
      showPopup(
        "This leave type requires an attachment URL",
        "error"
      );
      return;
    }
    if (halfDay && dateToYMD(fromDate) !== dateToYMD(toDate)) {
      showPopup(
        "Half-day must be a single date",
        "error"
      );
      return;
    }
    if (toDate < fromDate) {
      showPopup("To date must be on or after from date", "error");
      return;
    }

    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      await submitLeaveRequest(token, {
        leaveTypeCode: typeCode,
        fromDate: dateToYMD(fromDate),
        toDate: dateToYMD(toDate),
        reason: reason.trim(),
        halfDay,
        halfDayPart: halfDay ? halfDayPart : undefined,
        attachmentUrl: attachmentUrl.trim() || undefined,
      });

      showPopup("Leave request submitted");
      setModalVisible(false);
      await load();

    } catch (err: any) {
      // 409 = overlapping pending/approved leave. Show a friendly message.
      if (err?.status === 409) {
        showPopup(
          "You already have a leave request that overlaps these dates.",
          "error"
        );
      } else {
        showPopup(err?.message || "Failed to submit", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const askCancel = (req: LeaveRequest) => {
    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.confirm("Cancel this leave request?")
      ) {
        doCancel(req.id);
      }
      return;
    }
    Alert.alert(
      "Cancel request?",
      `${req.leaveTypeCode}  ·  ${req.fromDate} → ${req.toDate}`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel",
          style: "destructive",
          onPress: () => doCancel(req.id),
        },
      ]
    );
  };

  const doCancel = async (id: string) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await cancelLeaveRequest(token, id);
      showPopup("Cancelled");
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed to cancel", "error");
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#2563eb" />
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
            colors={["#3b82f6"]}
          />
        }
      >

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>My Leaves</Text>
            <Text style={styles.subtitle}>
              Balance & history
            </Text>
          </View>

          <TouchableOpacity
            style={styles.addBtn}
            onPress={openRequest}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* BALANCES */}
        <Text style={styles.section}>BALANCE</Text>

        {balances.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptySub}>
              No balances available yet.
            </Text>
          </View>
        ) : (
          <View style={styles.balanceGrid}>
            {balances.map((b) => (
              <View key={b.leaveTypeCode} style={styles.balanceCard}>
                <Text style={styles.balanceCode}>
                  {b.leaveType?.name || b.leaveTypeCode}
                </Text>
                <Text style={styles.balanceRemaining}>
                  {b.remaining}
                </Text>
                <Text style={styles.balanceUnit}>
                  remaining
                </Text>
                <View style={styles.balanceFooter}>
                  <Text style={styles.balanceMeta}>
                    Used {b.used}
                  </Text>
                  {b.pending > 0 && (
                    <Text
                      style={[
                        styles.balanceMeta,
                        { color: "#fbbf24" },
                      ]}
                    >
                      Pending {b.pending}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* HISTORY */}
        <Text style={[styles.section, { marginTop: 22 }]}>
          MY REQUESTS
        </Text>

        {mine.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptySub}>
              No leave requests yet. Tap + to apply.
            </Text>
          </View>
        ) : (
          mine.map((r) => (
            <View key={r.id} style={styles.requestCard}>
              <View style={styles.requestTop}>
                <View>
                  <Text style={styles.requestType}>
                    {r.leaveType?.name || r.leaveTypeCode}
                  </Text>
                  <Text style={styles.requestDates}>
                    {r.fromDate}
                    {r.fromDate !== r.toDate && ` → ${r.toDate}`}
                    {r.halfDay && " (half day)"}
                    {"  ·  "}
                    {r.totalDays}d
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusChip,
                    r.status === "APPROVED" && {
                      backgroundColor: "#16a34a",
                    },
                    r.status === "REJECTED" && {
                      backgroundColor: "#dc2626",
                    },
                    r.status === "CANCELLED" && {
                      backgroundColor: "#374151",
                    },
                    r.status === "PENDING" && {
                      backgroundColor: "#f59e0b",
                    },
                  ]}
                >
                  <Text style={styles.statusText}>
                    {r.status}
                  </Text>
                </View>
              </View>

              <Text style={styles.reasonLine}>{r.reason}</Text>

              {r.note ? (
                <Text style={styles.hrNote}>
                  HR note: {r.note}
                </Text>
              ) : null}

              {r.status === "PENDING" && (
                <TouchableOpacity
                  style={styles.cancelLine}
                  onPress={() => askCancel(r)}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={14}
                    color="#dc2626"
                  />
                  <Text style={styles.cancelText}>
                    Cancel request
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}

      </ScrollView>

      {/* REQUEST MODAL */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >

              <Text style={styles.modalTitle}>
                Request Leave
              </Text>

              <Text style={styles.label}>Type</Text>
              <View style={styles.chipPicker}>
                {types.map((t) => (
                  <TouchableOpacity
                    key={t.code}
                    style={[
                      styles.pickBtn,
                      typeCode === t.code && styles.pickActive,
                    ]}
                    onPress={() => setTypeCode(t.code)}
                  >
                    <Text
                      style={[
                        styles.pickText,
                        typeCode === t.code && {
                          color: "#fff",
                        },
                      ]}
                    >
                      {t.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>From</Text>
              {isWeb ? (
                <View style={styles.dateRow}>
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color="#94a3b8"
                  />
                  <WebDateField
                    mode="date"
                    value={dateToYMD(fromDate)}
                    onChange={(v) => {
                      const d = ymdToDate(v);
                      if (d) setFromDate(d);
                    }}
                  />
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.dateRow}
                    onPress={() => setShowFrom(true)}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color="#94a3b8"
                    />
                    <Text style={styles.dateText}>
                      {fromDate.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Text>
                  </TouchableOpacity>
                  {showFrom && (
                    <DateTimePicker
                      value={fromDate}
                      mode="date"
                      onChange={(_, d) => {
                        setShowFrom(Platform.OS === "ios");
                        if (d) setFromDate(d);
                      }}
                    />
                  )}
                </>
              )}

              <Text style={styles.label}>To</Text>
              {isWeb ? (
                <View style={styles.dateRow}>
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color="#94a3b8"
                  />
                  <WebDateField
                    mode="date"
                    value={dateToYMD(toDate)}
                    onChange={(v) => {
                      const d = ymdToDate(v);
                      if (d) setToDate(d);
                    }}
                  />
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.dateRow}
                    onPress={() => setShowTo(true)}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color="#94a3b8"
                    />
                    <Text style={styles.dateText}>
                      {toDate.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Text>
                  </TouchableOpacity>
                  {showTo && (
                    <DateTimePicker
                      value={toDate}
                      mode="date"
                      onChange={(_, d) => {
                        setShowTo(Platform.OS === "ios");
                        if (d) setToDate(d);
                      }}
                    />
                  )}
                </>
              )}

              {selectedType?.allowHalfDay && (
                <>
                  <View style={styles.toggleRow}>
                    <Text style={styles.label}>Half day</Text>
                    <Switch
                      value={halfDay}
                      onValueChange={setHalfDay}
                      trackColor={{
                        false: "#374151",
                        true: "#2563eb",
                      }}
                      thumbColor="#fff"
                    />
                  </View>

                  {halfDay && (
                    <View style={styles.chipPicker}>
                      <TouchableOpacity
                        style={[
                          styles.pickBtn,
                          halfDayPart === "FIRST" &&
                            styles.pickActive,
                        ]}
                        onPress={() =>
                          setHalfDayPart("FIRST")
                        }
                      >
                        <Text
                          style={[
                            styles.pickText,
                            halfDayPart === "FIRST" && {
                              color: "#fff",
                            },
                          ]}
                        >
                          First half
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.pickBtn,
                          halfDayPart === "SECOND" &&
                            styles.pickActive,
                        ]}
                        onPress={() =>
                          setHalfDayPart("SECOND")
                        }
                      >
                        <Text
                          style={[
                            styles.pickText,
                            halfDayPart === "SECOND" && {
                              color: "#fff",
                            },
                          ]}
                        >
                          Second half
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              <Text style={styles.label}>Reason</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={reason}
                onChangeText={setReason}
                placeholder="Why do you need this leave?"
                placeholderTextColor="#64748b"
                multiline
              />

              {selectedType?.requiresAttachment && (
                <>
                  <Text style={styles.label}>
                    Attachment URL{" "}
                    <Text style={{ color: "#dc2626" }}>
                      (required)
                    </Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={attachmentUrl}
                    onChangeText={setAttachmentUrl}
                    placeholder="https://drive.google.com/..."
                    placeholderTextColor="#64748b"
                    autoCapitalize="none"
                  />
                </>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    saving && { opacity: 0.7 },
                  ]}
                  onPress={submit}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalBtnText}>
                      Submit
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b1220" },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  loader: {
    flex: 1,
    backgroundColor: "#0b1220",
    justifyContent: "center",
    alignItems: "center",
  },

  popup: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    padding: 14,
    borderRadius: 14,
    zIndex: 999,
  },
  successPopup: { backgroundColor: "#16a34a" },
  errorPopup: { backgroundColor: "#dc2626" },
  popupText: { color: "#fff", fontWeight: "700", textAlign: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    marginTop: 10,
    gap: 12,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
  },
  title: { color: "#fff", fontSize: 24, fontWeight: "800" },
  subtitle: { color: "#94a3b8", fontSize: 13, marginTop: 3 },

  section: {
    color: "#64748b",
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: "700",
    marginBottom: 10,
  },

  balanceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  balanceCard: {
    flexGrow: 1,
    minWidth: "47%",
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  balanceCode: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  balanceRemaining: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    marginTop: 4,
  },
  balanceUnit: {
    color: "#64748b",
    fontSize: 11,
    marginTop: -2,
  },
  balanceFooter: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  balanceMeta: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
  },

  emptyBox: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 22,
    borderWidth: 1,
    borderColor: "#1f2937",
    alignItems: "center",
  },
  emptySub: {
    color: "#94a3b8",
    fontSize: 13,
    textAlign: "center",
  },

  requestCard: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  requestTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  requestType: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  requestDates: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 3,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  reasonLine: {
    color: "#cbd5e1",
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  hrNote: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 6,
    fontStyle: "italic",
  },
  cancelLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
    alignSelf: "flex-start",
  },
  cancelText: {
    color: "#dc2626",
    fontSize: 12,
    fontWeight: "700",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 20,
    maxHeight: "92%",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 12,
  },

  label: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 14,
  },

  chipPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#0f172a",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  pickActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  pickText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: "#1e293b",
    gap: 10,
  },
  dateText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },

  input: {
    backgroundColor: "#0f172a",
    color: "#fff",
    borderRadius: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: "#1e293b",
    fontSize: 14,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },

  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#374151",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveBtn: {
    flex: 1,
    backgroundColor: "#16a34a",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  modalBtnText: { color: "#fff", fontWeight: "700" },
});
