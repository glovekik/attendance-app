import React, { useEffect, useState, useCallback } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  getMyTimesheet,
  submitTimesheet,
} from "../src/services/timesheets";
import {
  Timesheet,
  TimesheetEntry,
  TimesheetStatus,
} from "../src/types";

// Helpers
const ymd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Returns Monday of the week containing `d` (Mon=0 in our scheme).
const mondayOf = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // back to Monday
  x.setDate(x.getDate() + diff);
  return x;
};

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const STATUS_COLOR: Record<TimesheetStatus, string> = {
  DRAFT: "#64748b",
  PENDING: "#f59e0b",
  APPROVED: "#16a34a",
  REJECTED: "#dc2626",
};

const STATUS_LABEL: Record<TimesheetStatus, string> = {
  DRAFT: "Draft (not submitted)",
  PENDING: "Awaiting manager",
  APPROVED: "Approved",
  REJECTED: "Rejected — fix & resubmit",
};

const WEEKDAYS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

export default function MyTimesheet() {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState<Date>(mondayOf(new Date()));
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const data = await getMyTimesheet(token, ymd(weekStart));
      setTimesheet(data);
      // Build a 7-row editable model, padding any missing days with 0
      const byDate: Record<string, TimesheetEntry> = {};
      (data.entries || []).forEach((e) => {
        byDate[e.date] = e;
      });
      const seven: TimesheetEntry[] = [];
      for (let i = 0; i < 7; i++) {
        const date = ymd(addDays(weekStart, i));
        seven.push(
          byDate[date] || {
            date,
            hours: 0,
            projectId: null,
            notes: "",
            billable: false,
          }
        );
      }
      setEntries(seven);
      setNote(data.note || "");
    } catch (err: any) {
      console.log("timesheet load error", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const goPrev = () => setWeekStart(addDays(weekStart, -7));
  const goNext = () => setWeekStart(addDays(weekStart, 7));
  const goCurrent = () => setWeekStart(mondayOf(new Date()));

  const updateEntry = (i: number, patch: Partial<TimesheetEntry>) => {
    setEntries((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  };

  const totalHours = entries.reduce(
    (sum, e) => sum + (Number(e.hours) || 0),
    0
  );

  // Editable only when DRAFT or REJECTED (resubmit allowed).
  const status: TimesheetStatus =
    (timesheet?.status as TimesheetStatus) || "DRAFT";
  const editable = status === "DRAFT" || status === "REJECTED";

  const onSubmit = async () => {
    if (!editable) return;
    if (totalHours <= 0) {
      Alert.alert(
        "No hours logged",
        "Add hours for at least one day before submitting."
      );
      return;
    }
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const payload = {
        weekStart: ymd(weekStart),
        note: note.trim() || undefined,
        entries: entries.map((e) => ({
          date: e.date,
          hours: Number(e.hours) || 0,
          projectId: e.projectId || undefined,
          notes: e.notes || undefined,
          billable: !!e.billable,
        })),
      };
      const saved = await submitTimesheet(token, payload);
      setTimesheet(saved);
      Alert.alert("Submitted", "Your timesheet is awaiting approval.");
    } catch (err: any) {
      Alert.alert("Submit failed", err?.message || "");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>My Timesheet</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#3b82f6"
              colors={["#3b82f6"]}
            />
          }
        >
          {/* Week navigation */}
          <View style={styles.weekNav}>
            <TouchableOpacity style={styles.navBtn} onPress={goPrev}>
              <Ionicons
                name="chevron-back"
                size={20}
                color="#fff"
              />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={styles.weekLabel}>
                Week of {ymd(weekStart)}
              </Text>
              <TouchableOpacity onPress={goCurrent}>
                <Text style={styles.currentLink}>Jump to this week</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.navBtn} onPress={goNext}>
              <Ionicons
                name="chevron-forward"
                size={20}
                color="#fff"
              />
            </TouchableOpacity>
          </View>

          {/* Status */}
          <View
            style={[
              styles.statusBar,
              { backgroundColor: STATUS_COLOR[status] },
            ]}
          >
            <Text style={styles.statusText}>{STATUS_LABEL[status]}</Text>
            <Text style={styles.totalText}>
              {totalHours.toFixed(1)} h
            </Text>
          </View>

          {status === "REJECTED" && !!timesheet?.decisionNote && (
            <View style={styles.rejectBox}>
              <Text style={styles.rejectTitle}>Rejection note</Text>
              <Text style={styles.rejectBody}>
                {timesheet.decisionNote}
              </Text>
            </View>
          )}

          {/* Entries */}
          {entries.map((e, i) => {
            const date = new Date(`${e.date}T00:00:00`);
            return (
              <View key={e.date} style={styles.row}>
                <View style={styles.dayHeader}>
                  <View>
                    <Text style={styles.dayName}>
                      {WEEKDAYS[i]} · {e.date}
                    </Text>
                    {e.attendanceStatus && (
                      <Text style={styles.attLabel}>
                        Attendance: {e.attendanceStatus}
                      </Text>
                    )}
                  </View>
                  <View style={styles.hoursWrap}>
                    <TextInput
                      style={styles.hoursInput}
                      value={String(e.hours)}
                      onChangeText={(v) =>
                        updateEntry(i, {
                          hours: parseFloat(v) || 0,
                        })
                      }
                      placeholder="0"
                      placeholderTextColor="#475569"
                      keyboardType="decimal-pad"
                      editable={editable}
                    />
                    <Text style={styles.hoursLabel}>h</Text>
                  </View>
                </View>
                <TextInput
                  style={styles.subInput}
                  value={e.projectId || ""}
                  onChangeText={(v) =>
                    updateEntry(i, { projectId: v || null })
                  }
                  placeholder="Project (optional)"
                  placeholderTextColor="#475569"
                  editable={editable}
                />
                <View style={styles.subRow}>
                  <TextInput
                    style={[styles.subInput, { flex: 1 }]}
                    value={e.notes || ""}
                    onChangeText={(v) => updateEntry(i, { notes: v })}
                    placeholder="Notes (optional)"
                    placeholderTextColor="#475569"
                    editable={editable}
                  />
                  <TouchableOpacity
                    style={[
                      styles.billBtn,
                      e.billable && styles.billBtnActive,
                    ]}
                    onPress={() =>
                      editable &&
                      updateEntry(i, { billable: !e.billable })
                    }
                    disabled={!editable}
                  >
                    <Text
                      style={[
                        styles.billText,
                        e.billable && styles.billTextActive,
                      ]}
                    >
                      BILL
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {/* Note */}
          <Text style={styles.label}>Note (optional)</Text>
          <TextInput
            style={[styles.subInput, { minHeight: 60 }]}
            value={note}
            onChangeText={setNote}
            placeholder="Anything you want manager to know..."
            placeholderTextColor="#475569"
            multiline
            editable={editable}
          />
        </ScrollView>

        {editable && (
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[
                styles.submitBtn,
                submitting && { opacity: 0.6 },
              ]}
              onPress={onSubmit}
              disabled={submitting}
            >
              <Text style={styles.submitText}>
                {submitting
                  ? "Submitting..."
                  : status === "REJECTED"
                  ? "Resubmit"
                  : "Submit timesheet"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b1220" },
  loader: {
    flex: 1,
    backgroundColor: "#0b1220",
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    gap: 12,
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "800", flex: 1 },
  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },
  weekLabel: { color: "#fff", fontSize: 14, fontWeight: "700" },
  currentLink: { color: "#3b82f6", fontSize: 11, marginTop: 2 },
  statusBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  statusText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  totalText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  rejectBox: {
    backgroundColor: "#3a1212",
    borderColor: "#7f1d1d",
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  rejectTitle: {
    color: "#fca5a5",
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "800",
  },
  rejectBody: { color: "#fecaca", fontSize: 13, marginTop: 4 },
  row: {
    backgroundColor: "#111827",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  dayName: { color: "#fff", fontSize: 14, fontWeight: "700" },
  attLabel: { color: "#94a3b8", fontSize: 10, marginTop: 2 },
  hoursWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 8,
    paddingHorizontal: 10,
    gap: 6,
  },
  hoursInput: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    minWidth: 50,
    textAlign: "right",
    paddingVertical: 6,
  },
  hoursLabel: { color: "#94a3b8", fontSize: 12 },
  subInput: {
    backgroundColor: "#0f172a",
    color: "#fff",
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  billBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  billBtnActive: {
    backgroundColor: "#16a34a",
    borderColor: "#16a34a",
  },
  billText: { color: "#64748b", fontSize: 10, fontWeight: "800" },
  billTextActive: { color: "#fff" },
  label: {
    color: "#94a3b8",
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 6,
  },
  bottomBar: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
    backgroundColor: "#0b1220",
  },
  submitBtn: {
    backgroundColor: "#3b82f6",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  submitText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
