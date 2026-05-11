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
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  checkIn,
  checkOut,
  getToday,
} from "../src/services/api";

import { getMyTasks } from "../src/services/tasks";

import { dateToYMD } from "../src/components/WebDateField";

import {
  OFFICE,
  ALLOWED_RADIUS,
  getCurrentLocation,
  getDistance,
} from "../src/utils/location";

export default function Attendance() {

  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [todayAttendance, setTodayAttendance] =
    useState<any>(null);

  const [attendanceType, setAttendanceType] =
    useState("OFFICE");

  const [workNotes, setWorkNotes] =
    useState("");

  const [popup, setPopup] =
    useState({

      visible: false,

      type: "success",

      message: "",
    });

  // ================= FORMAT TIME =================
  const formatTime = (
    time: string
  ) => {

    if (!time) return "-";

    try {

      const date =
        new Date(time);

      let hours =
        date.getHours();

      const minutes =
        date.getMinutes();

      const ampm =
        hours >= 12
          ? "PM"
          : "AM";

      hours =
        hours % 12;

      hours =
        hours
          ? hours
          : 12;

      const minuteStr =
        minutes
          .toString()
          .padStart(2, "0");

      return `${hours}:${minuteStr} ${ampm}`;

    } catch (err) {

      console.log(
        "Time format error:",
        err
      );

      return "-";
    }
  };

  // ================= SUCCESS =================
  const showSuccess = (
    message: string
  ) => {

    setPopup({

      visible: true,

      type: "success",

      message,
    });

    setTimeout(() => {

      setPopup(prev => ({

        ...prev,

        visible: false,
      }));

    }, 3000);
  };

  // ================= ERROR =================
  const showError = (
    err: any
  ) => {

    console.log(err);

    const message =

      err?.message ||

      err?.response?.data?.detail ||

      "Something went wrong";

    setPopup({

      visible: true,

      type: "error",

      message,
    });

    setTimeout(() => {

      setPopup(prev => ({

        ...prev,

        visible: false,
      }));

    }, 3000);
  };

  // ================= LOAD TODAY =================
  const loadToday = async () => {

    try {

      const token =
        await AsyncStorage.getItem(
          "token"
        );

      if (!token) {

        router.replace("/login");

        return;
      }

      const res =
        await getToday(token, dateToYMD(new Date()));

      console.log(
        "TODAY:",
        res
      );

      setTodayAttendance(res);

      if (
        res?.attendanceType
      ) {

        setAttendanceType(
          res.attendanceType
        );
      }

      if (
        res?.workNotes
      ) {

        setWorkNotes(
          res.workNotes
        );
      }

    } catch (err) {

      showError(err);

    }

    setLoading(false);
  };

  // ================= PULL FROM TASKS =================
  const pullFromTasks = async () => {

    try {

      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      const tasks = await getMyTasks(token, "COMPLETED");

      const isToday = (iso?: string | null) => {
        if (!iso) return false;
        const d = new Date(iso);
        const now = new Date();
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate()
        );
      };

      const done = (tasks || []).filter((t) =>
        isToday(t.completedAt)
      );

      if (done.length === 0) {
        showError({
          message: "No tasks completed today yet",
        });
        return;
      }

      const summary = done
        .map((t) => `- ${t.title}`)
        .join("\n");

      setWorkNotes(summary);

      showSuccess(
        `Pulled ${done.length} task${
          done.length === 1 ? "" : "s"
        }`
      );

    } catch (err) {
      showError(err);
    }
  };

  // ================= HANDLE CHECKIN =================
  const handleCheckIn =
    async () => {

      try {

        const payload: any = {
          date: dateToYMD(new Date()),
          attendanceType: attendanceType,
        };

        // Capture coords for OFFICE so the server can validate the geofence
        if (attendanceType === "OFFICE") {
          try {
            const coords = await getCurrentLocation();

            // Optional UX-first hint before the network round-trip
            const distance = getDistance(
              coords.latitude,
              coords.longitude,
              OFFICE.latitude,
              OFFICE.longitude
            );
            if (distance > ALLOWED_RADIUS) {
              showError({
                message: `You're ${Math.round(
                  distance
                )}m from office. Switch to WFH if remote.`,
              });
              return;
            }

            payload.latitude = coords.latitude;
            payload.longitude = coords.longitude;
          } catch (locErr: any) {
            showError({
              message:
                locErr?.message ||
                "Couldn't verify your location. Enable location and try again.",
            });
            return;
          }
        }

        const token =
          await AsyncStorage.getItem(
            "token"
          );

        if (!token) return;

        await checkIn(
          token,
          payload
        );

        showSuccess(
          "Checked in successfully"
        );

        await loadToday();

      } catch (err) {

        showError(err);
      }
    };

  // ================= HANDLE CHECKOUT =================
  const handleCheckOut =
    async () => {

      try {

        if (!workNotes.trim()) {

          showError({
            message:
              "Please enter work notes"
          });

          return;
        }

        const token =
          await AsyncStorage.getItem(
            "token"
          );

        if (!token) return;

        const payload = {

          date: dateToYMD(new Date()),

          workNotes:
            workNotes,
        };

        await checkOut(
          token,
          payload
        );

        showSuccess(
          "Checked out successfully"
        );

        await loadToday();

      } catch (err) {

        showError(err);
      }
    };

  useEffect(() => {

    loadToday();

  }, []);

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

  const status =
    todayAttendance?.status;

  const checkedIn =
    status === "CHECKED_IN";

  const completed =
    status === "COMPLETED";

  return (

    <View style={{ flex: 1 }}>

      {/* POPUP */}
      {popup.visible && (

        <View
          style={[

            styles.popup,

            popup.type === "success"
              ? styles.successPopup
              : styles.errorPopup,
          ]}
        >

          <Text style={styles.popupText}>
            {popup.message}
          </Text>

        </View>

      )}

      <ScrollView
        style={styles.container}
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >

        {/* HEADER */}
        <View style={styles.header}>

          <TouchableOpacity
            style={styles.backBtn}
            onPress={() =>
              router.back()
            }
          >

            <Ionicons
              name="arrow-back"
              size={22}
              color="#fff"
            />

          </TouchableOpacity>

          <View style={{ flex: 1 }}>

            <Text style={styles.title}>
              Attendance
            </Text>

            <Text style={styles.subtitle}>
              Track your workday
            </Text>

          </View>

          <TouchableOpacity
            style={styles.historyBtn}
            onPress={() =>
              router.push("/history")
            }
          >

            <Ionicons
              name="time-outline"
              size={20}
              color="#fff"
            />

          </TouchableOpacity>

        </View>

        {/* STATUS CARD */}
        <View style={styles.statusCard}>

          <View style={styles.statusRow}>

            <Text style={styles.statusLabel}>
              Type
            </Text>

            <Text style={styles.statusValue}>
              {
                todayAttendance
                  ?.attendanceType || "-"
              }
            </Text>

          </View>

          <View style={styles.statusRow}>

            <Text style={styles.statusLabel}>
              Status
            </Text>

            <Text style={styles.statusValue}>
              {
                todayAttendance
                  ?.status || "NOT STARTED"
              }
            </Text>

          </View>

          <View style={styles.statusRow}>

            <Text style={styles.statusLabel}>
              Check In
            </Text>

            <Text style={styles.statusValue}>

              {formatTime(
                todayAttendance?.checkIn
              )}

            </Text>

          </View>

          <View style={styles.statusRow}>

            <Text style={styles.statusLabel}>
              Check Out
            </Text>

            <Text style={styles.statusValue}>

              {formatTime(
                todayAttendance?.checkOut
              )}

            </Text>

          </View>

        </View>

        {/* TYPE SELECT */}
        {!checkedIn &&
          !completed && (

            <View style={styles.section}>

              <Text style={styles.sectionTitle}>
                Select Attendance Type
              </Text>

              <View style={styles.typeGrid}>

                {[
                  "OFFICE",
                  "WFH",
                  "LEAVE",
                  "HOLIDAY",
                ].map((item) => (

                  <TouchableOpacity
                    key={item}
                    style={[

                      styles.typeBtn,

                      attendanceType ===
                        item &&
                        styles.activeType,
                    ]}
                    onPress={() =>
                      setAttendanceType(
                        item
                      )
                    }
                  >

                    <Text
                      style={
                        styles.typeText
                      }
                    >
                      {item}
                    </Text>

                  </TouchableOpacity>

                ))}

              </View>

            </View>

          )}

        {/* NOTES */}
        {(checkedIn ||
          completed) && (

          <View style={styles.card}>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >

              <Text style={styles.label}>
                Work Notes
              </Text>

              {!completed && (
                <TouchableOpacity
                  onPress={pullFromTasks}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#1e293b",
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    gap: 4,
                  }}
                >
                  <Ionicons
                    name="sparkles-outline"
                    size={14}
                    color="#60a5fa"
                  />
                  <Text
                    style={{
                      color: "#60a5fa",
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    Pull from tasks
                  </Text>
                </TouchableOpacity>
              )}

            </View>

            <TextInput
              style={styles.input}
              placeholder="Enter work notes"
              placeholderTextColor="#64748b"
              value={workNotes}
              onChangeText={
                setWorkNotes
              }
              multiline
              editable={!completed}
            />

          </View>

        )}

        {/* CHECK IN */}
        {!checkedIn &&
          !completed && (

            <TouchableOpacity
              style={
                styles.checkInBtn
              }
              onPress={
                handleCheckIn
              }
            >

              <Ionicons
                name="log-in-outline"
                size={22}
                color="#fff"
              />

              <Text
                style={
                  styles.actionText
                }
              >
                Check In
              </Text>

            </TouchableOpacity>

          )}

        {/* CHECK OUT */}
        {checkedIn && (

          <TouchableOpacity
            style={
              styles.checkOutBtn
            }
            onPress={
              handleCheckOut
            }
          >

            <Ionicons
              name="log-out-outline"
              size={22}
              color="#fff"
            />

            <Text
              style={
                styles.actionText
              }
            >
              Check Out
            </Text>

          </TouchableOpacity>

        )}

        {/* COMPLETED */}
        {completed && (

          <View
            style={
              styles.completedCard
            }
          >

            <Ionicons
              name="checkmark-circle"
              size={32}
              color="#22c55e"
            />

            <Text
              style={
                styles.completedText
              }
            >
              Attendance Completed
            </Text>

          </View>

        )}

      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#0b1220",
  },

  content: {
    padding: 20,
    paddingBottom: 50,
  },

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
    padding: 16,
    borderRadius: 14,
    zIndex: 999,
  },

  successPopup: {
    backgroundColor: "#16a34a",
  },

  errorPopup: {
    backgroundColor: "#dc2626",
  },

  popupText: {
    color: "#fff",
    fontWeight: "700",
    textAlign: "center",
  },

  header: {
    marginTop: 60,
    marginBottom: 24,
    flexDirection: "row",
    alignItems: "center",
  },

  backBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    borderWidth: 1,
    borderColor: "#1f2937",
  },

  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
  },

  subtitle: {
    color: "#94a3b8",
    marginTop: 4,
  },

  historyBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
  },

  statusCard: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#1f2937",
  },

  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  statusLabel: {
    color: "#94a3b8",
    fontWeight: "600",
  },

  statusValue: {
    color: "#fff",
    fontWeight: "700",
  },

  section: {
    marginBottom: 24,
  },

  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 14,
  },

  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  typeBtn: {
    width: "48%",
    backgroundColor: "#111827",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1f2937",
    marginBottom: 12,
  },

  activeType: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },

  typeText: {
    color: "#fff",
    fontWeight: "700",
  },

  card: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#1f2937",
  },

  label: {
    color: "#94a3b8",
    marginBottom: 10,
    fontSize: 14,
    fontWeight: "600",
  },

  input: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 14,
    color: "#fff",
    minHeight: 120,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#1e293b",
  },

  checkInBtn: {
    backgroundColor: "#16a34a",
    padding: 18,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },

  checkOutBtn: {
    backgroundColor: "#dc2626",
    padding: 18,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },

  actionText: {
    color: "#fff",
    fontWeight: "700",
    marginLeft: 8,
    fontSize: 16,
  },

  completedCard: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 30,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#22c55e",
  },

  completedText: {
    color: "#22c55e",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 12,
  },

});