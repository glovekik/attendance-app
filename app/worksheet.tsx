import React, {
  useEffect,
  useMemo,
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
  Alert,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  getToday,
  checkIn,
  checkOut,
} from "../src/services/api";

export default function Worksheet() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [attendance, setAttendance] = useState<any>(null);

  const [notes, setNotes] = useState("");

  const [checkedIn, setCheckedIn] = useState(false);

  const [completed, setCompleted] = useState(false);

  // ================= TODAY =================
  const today = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  // ================= LOAD TODAY =================
  const loadToday = async () => {
    try {

      const token = await AsyncStorage.getItem("token");

      if (!token) {
        router.replace("/login");
        return;
      }

      const res = await getToday(token);

      if (res && Object.keys(res).length > 0) {

        setAttendance(res);

        setNotes(res.workNotes || "");

        if (res.status === "CHECKED_IN") {
          setCheckedIn(true);
        }

        if (res.status === "COMPLETED") {
          setCheckedIn(true);
          setCompleted(true);
        }
      }

    } catch (err) {
      console.log("Worksheet error:", err);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadToday();
  }, []);

  // ================= CHECK IN =================
  const handleCheckIn = async () => {

    try {

      const token = await AsyncStorage.getItem("token");

      if (!token) return;

      const res = await checkIn(token, {
        date: today,
        attendanceType: "OFFICE",
      });

      console.log(res);

      await loadToday();

      Alert.alert(
        "Success",
        "Check-in successful"
      );

    } catch (err) {
      console.log(err);
    }
  };

  // ================= CHECK OUT =================
  const handleCheckOut = async () => {

    try {

      if (!notes.trim()) {
        Alert.alert(
          "Notes required",
          "Please enter work notes before checking out"
        );
        return;
      }

      const token = await AsyncStorage.getItem("token");

      if (!token) return;

      const res = await checkOut(token, {
        date: today,
        workNotes: notes,
      });

      console.log(res);

      await loadToday();

      Alert.alert(
        "Completed",
        "Worksheet submitted successfully"
      );

    } catch (err) {
      console.log(err);
    }
  };

  // ================= TIMER =================
  const getDuration = () => {

    if (!attendance?.checkIn) {
      return "0h 0m";
    }

    const start = new Date(
      attendance.checkIn
    ).getTime();

    const end = attendance?.checkOut
      ? new Date(attendance.checkOut).getTime()
      : Date.now();

    const diff = end - start;

    const hours = Math.floor(
      diff / (1000 * 60 * 60)
    );

    const mins = Math.floor(
      (diff % (1000 * 60 * 60))
      / (1000 * 60)
    );

    return `${hours}h ${mins}m`;
  };

  // ================= LOADING =================
  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator
          size="large"
          color="#2563eb"
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >

      {/* HEADER */}
      <View style={styles.header}>

        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace("/")}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color="#fff"
          />
        </TouchableOpacity>

        <Text style={styles.title}>
          Worksheet
        </Text>

        <View style={{ width: 42 }} />

      </View>

      {/* STATUS */}
      <View style={styles.statusCard}>

        <View style={styles.statusTop}>

          <View style={styles.statusIcon}>
            <Ionicons
              name="briefcase-outline"
              size={22}
              color="#fff"
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>
              Today's Status
            </Text>

            <Text style={styles.statusSub}>
              {completed
                ? "Work session completed"
                : checkedIn
                ? "You are checked in"
                : "Not checked in yet"}
            </Text>
          </View>

        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>
            Date
          </Text>

          <Text style={styles.value}>
            {today}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>
            Check In
          </Text>

          <Text style={styles.value}>
            {attendance?.checkIn
              ? new Date(
                  attendance.checkIn
                ).toLocaleTimeString()
              : "-"}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>
            Check Out
          </Text>

          <Text style={styles.value}>
            {attendance?.checkOut
              ? new Date(
                  attendance.checkOut
                ).toLocaleTimeString()
              : "-"}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>
            Duration
          </Text>

          <Text style={styles.value}>
            {getDuration()}
          </Text>
        </View>

      </View>

      {/* NOTES */}
      <View style={styles.notesCard}>

        <Text style={styles.notesTitle}>
          Work Notes
        </Text>

        <Text style={styles.notesSub}>
          Describe today's work activity
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Write your work updates..."
          placeholderTextColor="#64748b"
          multiline
          value={notes}
          editable={!completed}
          onChangeText={setNotes}
        />

      </View>

      {/* ACTIONS */}
      {!checkedIn && (
        <TouchableOpacity
          style={styles.checkInBtn}
          onPress={handleCheckIn}
        >
          <Ionicons
            name="log-in-outline"
            size={20}
            color="#fff"
          />

          <Text style={styles.btnText}>
            Check In
          </Text>
        </TouchableOpacity>
      )}

      {checkedIn && !completed && (
        <TouchableOpacity
          style={styles.checkOutBtn}
          onPress={handleCheckOut}
        >
          <Ionicons
            name="log-out-outline"
            size={20}
            color="#fff"
          />

          <Text style={styles.btnText}>
            Check Out
          </Text>
        </TouchableOpacity>
      )}

      {completed && (
        <View style={styles.completedBox}>
          <Ionicons
            name="checkmark-circle"
            size={22}
            color="#22c55e"
          />

          <Text style={styles.completedText}>
            Today's worksheet completed
          </Text>
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b1220",
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  loader: {
    flex: 1,
    backgroundColor: "#0b1220",
    justifyContent: "center",
    alignItems: "center",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },

  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
  },

  statusCard: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#1f2937",
  },

  statusTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },

  statusIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  statusTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },

  statusSub: {
    color: "#94a3b8",
    marginTop: 3,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  label: {
    color: "#94a3b8",
  },

  value: {
    color: "#fff",
    fontWeight: "600",
  },

  notesCard: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#1f2937",
    marginBottom: 22,
  },

  notesTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },

  notesSub: {
    color: "#94a3b8",
    marginTop: 4,
    marginBottom: 14,
  },

  input: {
    minHeight: 180,
    backgroundColor: "#0f172a",
    borderRadius: 14,
    padding: 14,
    color: "#fff",
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#1e293b",
  },

  checkInBtn: {
    backgroundColor: "#2563eb",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    gap: 8,
  },

  checkOutBtn: {
    backgroundColor: "#dc2626",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    gap: 8,
  },

  btnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },

  completedBox: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#166534",
  },

  completedText: {
    color: "#22c55e",
    fontWeight: "700",
  },
});