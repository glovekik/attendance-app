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
  SafeAreaView,
  Switch,
  Platform,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  useRouter,
  useLocalSearchParams,
} from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import DateTimePicker from "@react-native-community/datetimepicker";

import {
  WebDateField,
  dateToYMD,
  ymdToDate,
} from "../../src/components/WebDateField";

import {
  getTeam,
  listMyLedTeams,
} from "../../src/services/teams";

import { listUsers } from "../../src/services/users";
import { getMe } from "../../src/services/api";
import { createTask, getMyTasks } from "../../src/services/tasks";
import { scheduleTaskReminder } from "../../src/services/reminders";
import { requestNotificationPermission } from "../../src/services/notifications";

import {
  Team,
  User,
  hasRole,
} from "../../src/types";

const isWeb = Platform.OS === "web";

const INTERVALS = [5, 10, 15, 30, 60];

export default function NewTask() {

  const router = useRouter();

  const params = useLocalSearchParams();
  const teamId = params.teamId as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [loadingTeam, setLoadingTeam] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");

  const [hasDueDate, setHasDueDate] = useState(false);
  const [dueDate, setDueDate] = useState<Date>(new Date());
  const [showDuePicker, setShowDuePicker] = useState(false);

  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [interval, setInterval] = useState(15);

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

  // ================= LOAD TEAM =================
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token || !teamId) return;

        const me = await getMe(token);

        let t: Team;

        if (hasRole(me, "HR")) {
          const [hrTeam, allUsers] = await Promise.all([
            getTeam(token, teamId),
            listUsers(token),
          ]);
          const members = hrTeam.memberIds
            .map((id) => allUsers.find((u: User) => u.id === id))
            .filter(Boolean) as User[];
          t = { ...hrTeam, members };
        } else {
          const myTeams = await listMyLedTeams(token);
          const found = myTeams.find((x) => x.id === teamId);
          if (!found) {
            throw new Error("Team not found");
          }
          // If backend populated members[], use it.
          // Otherwise fall back to ID-based placeholders.
          const members: User[] =
            found.members && found.members.length > 0
              ? found.members
              : found.memberIds.map((id) => ({
                  id,
                  name: `User …${id.slice(-4)}`,
                  email: "",
                  role: "USER" as const,
                }));
          t = { ...found, members };
        }

        setTeam(t);

        if (t.members && t.members.length > 0) {
          setAssigneeId(t.members[0].id);
        }
      } catch (err: any) {
        showPopup(err?.message || "Failed to load team", "error");
      }
      setLoadingTeam(false);
    })();
  }, [teamId]);

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  // ================= SAVE =================
  const save = async () => {

    if (saving) return;

    if (!title.trim()) {
      showPopup("Task title required", "error");
      return;
    }

    if (!assigneeId) {
      showPopup("Pick an assignee", "error");
      return;
    }

    try {

      setSaving(true);

      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      if (reminderEnabled) {
        await requestNotificationPermission();
      }

      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        assigneeId,
        dueDate: hasDueDate ? dateToYMD(dueDate) : undefined,
        reminderIntervalMinutes: reminderEnabled
          ? interval
          : undefined,
      };

      const res = await createTask(token, teamId, payload);

      // If we just assigned to ourselves with a reminder, schedule it.
      if (reminderEnabled) {
        try {
          const me = await getMe(token);
          if (me.id === assigneeId) {
            const myTasks = await getMyTasks(token);
            const created = myTasks.find((t) => t.id === res.id);
            if (created) {
              await scheduleTaskReminder(created);
            }
          }
        } catch {
          // best-effort scheduling
        }
      }

      showPopup("Task created");

      setTimeout(() => {
        router.back();
      }, 700);

    } catch (err: any) {
      showPopup(err?.message || "Failed to create task", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loadingTeam) {
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
        keyboardShouldPersistTaps="handled"
      >

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>New Task</Text>
            <Text style={styles.subtitle}>
              {team?.name || "Team"}
            </Text>
          </View>
        </View>

        {/* TITLE */}
        <Text style={styles.section}>TITLE</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="What needs to be done?"
          placeholderTextColor="#64748b"
        />

        {/* DESCRIPTION */}
        <Text style={styles.section}>DESCRIPTION</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="Optional details"
          placeholderTextColor="#64748b"
          multiline
        />

        {/* ASSIGNEE */}
        <Text style={styles.section}>ASSIGN TO</Text>
        <View style={styles.assigneeWrap}>
          {(team?.members || []).map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[
                styles.assigneeBtn,
                assigneeId === m.id && styles.assigneeActive,
              ]}
              onPress={() => setAssigneeId(m.id)}
            >
              <Text
                style={[
                  styles.assigneeText,
                  assigneeId === m.id && { color: "#fff" },
                ]}
              >
                {m.name}
              </Text>
            </TouchableOpacity>
          ))}
          {(team?.members || []).length === 0 && (
            <Text style={{ color: "#94a3b8" }}>
              No members in this team yet.
            </Text>
          )}
        </View>

        {/* DUE DATE */}
        <View style={styles.toggleRow}>
          <Text style={styles.section}>DUE DATE</Text>
          <Switch
            value={hasDueDate}
            onValueChange={setHasDueDate}
            trackColor={{ false: "#374151", true: "#2563eb" }}
            thumbColor="#fff"
          />
        </View>

        {hasDueDate && (
          isWeb ? (
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color="#fff"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Due</Text>
                <WebDateField
                  mode="date"
                  value={dateToYMD(dueDate)}
                  onChange={(v) => {
                    const d = ymdToDate(v);
                    if (d) setDueDate(d);
                  }}
                />
              </View>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={styles.row}
                onPress={() => setShowDuePicker(true)}
              >
                <View style={styles.rowIcon}>
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color="#fff"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>Due</Text>
                  <Text style={styles.rowValue}>
                    {formatDate(dueDate)}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="#64748b"
                />
              </TouchableOpacity>
              {showDuePicker && (
                <DateTimePicker
                  value={dueDate}
                  mode="date"
                  onChange={(_, d) => {
                    setShowDuePicker(Platform.OS === "ios");
                    if (d) setDueDate(d);
                  }}
                />
              )}
            </>
          )
        )}

        {/* REMINDER */}
        <View style={styles.toggleRow}>
          <Text style={styles.section}>REMINDER</Text>
          <Switch
            value={reminderEnabled}
            onValueChange={setReminderEnabled}
            trackColor={{ false: "#374151", true: "#2563eb" }}
            thumbColor="#fff"
          />
        </View>

        {reminderEnabled && (
          <>
            <Text style={styles.miniLabel}>
              Notify the assignee every
            </Text>
            <View style={styles.intervalRow}>
              {INTERVALS.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.intervalBtn,
                    interval === m && styles.intervalActive,
                  ]}
                  onPress={() => setInterval(m)}
                >
                  <Text
                    style={[
                      styles.intervalText,
                      interval === m && { color: "#fff" },
                    ]}
                  >
                    {m}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.hint}>
              Reminders fire on the assignee's device after they open
              the app. They stop once the task is marked done.
            </Text>
          </>
        )}

        {/* SAVE */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={save}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color="#fff"
              />
              <Text style={styles.saveText}>Create Task</Text>
            </>
          )}
        </TouchableOpacity>

      </ScrollView>

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
    marginBottom: 16,
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
  title: { color: "#fff", fontSize: 24, fontWeight: "800" },
  subtitle: { color: "#94a3b8", fontSize: 13, marginTop: 3 },

  section: {
    color: "#64748b",
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 18,
  },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  miniLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 6,
  },

  hint: {
    color: "#64748b",
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 10,
  },

  input: {
    backgroundColor: "#111827",
    color: "#fff",
    borderRadius: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: "#1f2937",
    fontSize: 14,
  },

  multiline: {
    minHeight: 90,
    textAlignVertical: "top",
  },

  assigneeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  assigneeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#111827",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  assigneeActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  assigneeText: { color: "#94a3b8", fontWeight: "600", fontSize: 13 },

  intervalRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  intervalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#111827",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  intervalActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  intervalText: { color: "#94a3b8", fontWeight: "700", fontSize: 13 },

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
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
  },
  rowLabel: { color: "#94a3b8", fontSize: 11, fontWeight: "600" },
  rowValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },

  saveBtn: {
    marginTop: 26,
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
