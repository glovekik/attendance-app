import React, {
  useEffect,
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Platform,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import DateTimePicker from "@react-native-community/datetimepicker";

import {
  WebDateField,
  dateToHM,
  hmToDate,
} from "../src/components/WebDateField";

import {
  getHistory,
  deleteAttendance,
  updateAttendance,
} from "../src/services/api";

import {
  requestCorrection,
  listMyCorrections,
} from "../src/services/corrections";

import { AttendanceCorrection } from "../src/types";

const isWeb = Platform.OS === "web";

export default function History() {

  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [history, setHistory] =
    useState<any[]>([]);

  // ================= POPUP =================
  const [popup, setPopup] =
    useState({

      visible: false,

      type: "success",

      message: "",
    });

  // ================= EDIT MODAL =================
  const [editVisible, setEditVisible] =
    useState(false);

  const [selectedItem, setSelectedItem] =
    useState<any>(null);

  const [editType, setEditType] =
    useState("");

  const [editNotes, setEditNotes] =
    useState("");

  const [editCheckIn, setEditCheckIn] =
    useState<Date | null>(null);

  const [editCheckOut, setEditCheckOut] =
    useState<Date | null>(null);

  // ================= CORRECTION =================
  const [corrections, setCorrections] =
    useState<AttendanceCorrection[]>([]);

  const [corrVisible, setCorrVisible] =
    useState(false);

  const [corrItem, setCorrItem] =
    useState<any>(null);

  const [corrCheckOut, setCorrCheckOut] =
    useState<Date | null>(null);

  const [corrShowPicker, setCorrShowPicker] =
    useState(false);

  const [corrReason, setCorrReason] =
    useState("");

  const [corrSaving, setCorrSaving] =
    useState(false);

  const [showInPicker, setShowInPicker] =
    useState(false);

  const [showOutPicker, setShowOutPicker] =
    useState(false);

  // ================= FORMAT TIME =================
  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  const combine = (
    baseDateStr: string,
    t: Date
  ) => {

    const base = new Date(
      `${baseDateStr}T00:00:00`
    );

    base.setHours(
      t.getHours(),
      t.getMinutes(),
      0,
      0
    );

    return base.toISOString();
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

      err?.response?.data?.detail ||

      err?.message ||

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

  // ================= LOAD HISTORY =================
  const loadHistory = async () => {

    try {

      const token =
        await AsyncStorage.getItem(
          "token"
        );

      if (!token) {

        router.replace("/login");

        return;
      }

      const [histRes, corrRes] = await Promise.all([
        getHistory(token),
        listMyCorrections(token).catch(() => []),
      ]);

      setHistory(histRes);
      setCorrections(corrRes || []);

    } catch (err) {

      showError(err);

    }

    setLoading(false);
  };

  // ================= CORRECTION HELPERS =================
  const correctionFor = (
    attendanceId: string
  ): AttendanceCorrection | undefined => {
    return corrections
      .filter((c) => c.attendanceId === attendanceId)
      .sort((a, b) =>
        b.requestedAt.localeCompare(a.requestedAt)
      )[0];
  };

  const openCorrection = (item: any) => {
    setCorrItem(item);
    setCorrCheckOut(
      item.checkOut ? new Date(item.checkOut) : new Date()
    );
    setCorrReason("");
    setCorrVisible(true);
  };

  const submitCorrection = async () => {

    if (corrSaving || !corrItem) return;

    if (!corrReason.trim()) {
      showError({ message: "Please give a reason" });
      return;
    }

    if (!corrCheckOut) {
      showError({ message: "Pick the actual check-out time" });
      return;
    }

    try {
      setCorrSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      // Combine the record's date with the picked time
      const base = new Date(`${corrItem.date}T00:00:00`);
      base.setHours(
        corrCheckOut.getHours(),
        corrCheckOut.getMinutes(),
        0,
        0
      );

      await requestCorrection(token, corrItem.id, {
        requestedCheckOut: base.toISOString(),
        reason: corrReason.trim(),
      });

      showSuccess("Correction request submitted");
      setCorrVisible(false);
      await loadHistory();

    } catch (err) {
      showError(err);
    } finally {
      setCorrSaving(false);
    }
  };

  // ================= DELETE =================
  const handleDelete =
    async (id: string) => {

      try {

        const token =
          await AsyncStorage.getItem(
            "token"
          );

        if (!token) return;

        await deleteAttendance(
          token,
          id
        );

        showSuccess(
          "Attendance deleted"
        );

        await loadHistory();

      } catch (err) {

        showError(err);
      }
    };

  // ================= OPEN EDIT =================
  const openEdit = (
    item: any
  ) => {

    setSelectedItem(item);

    setEditType(
      item.attendanceType
    );

    setEditNotes(
      item.workNotes || ""
    );

    setEditCheckIn(
      item.checkIn
        ? new Date(item.checkIn)
        : null
    );

    setEditCheckOut(
      item.checkOut
        ? new Date(item.checkOut)
        : null
    );

    setEditVisible(true);
  };

  // ================= SAVE EDIT =================
  const saveEdit =
    async () => {

      try {

        const token =
          await AsyncStorage.getItem(
            "token"
          );

        if (!token) return;

        const requiresTime =
          editType === "OFFICE" ||
          editType === "WFH";

        if (requiresTime) {

          if (!editCheckIn) {
            showError({ message: "Check-in time required" });
            return;
          }

          if (!editCheckOut) {
            showError({ message: "Check-out time required" });
            return;
          }

          const inMins =
            editCheckIn.getHours() * 60 +
            editCheckIn.getMinutes();

          const outMins =
            editCheckOut.getHours() * 60 +
            editCheckOut.getMinutes();

          if (outMins <= inMins) {
            showError({
              message: "Check-out must be after check-in",
            });
            return;
          }
        }

        if (!editNotes.trim()) {

          showError({
            message:
              "Notes required"
          });

          return;
        }

        const baseDate = selectedItem.date;

        await updateAttendance(

          token,

          selectedItem.id,

          {

            attendanceType:
              editType,

            workNotes:
              editNotes,

            checkIn:
              requiresTime && editCheckIn
                ? combine(baseDate, editCheckIn)
                : null,

            checkOut:
              requiresTime && editCheckOut
                ? combine(baseDate, editCheckOut)
                : null,
          }
        );

        showSuccess(
          "Attendance updated"
        );

        setEditVisible(false);

        await loadHistory();

      } catch (err) {

        showError(err);
      }
    };

  useEffect(() => {
    loadHistory();
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

  return (

    <View style={styles.container}>

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

      {/* HEADER */}
      <View style={styles.header}>

        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() =>
            router.back()
          }
        >

          <Ionicons
            name="chevron-back"
            size={22}
            color="#fff"
          />

        </TouchableOpacity>

        <Text style={styles.title}>
          Attendance History
        </Text>

        <View style={{ width: 42 }} />

      </View>

      {/* ADD MANUAL ENTRY */}
      <TouchableOpacity
        style={styles.manualBtn}
        onPress={() =>
          router.push("/manual")
        }
      >

        <Ionicons
          name="add-circle-outline"
          size={20}
          color="#fff"
        />

        <Text style={styles.manualBtnText}>
          Add Manual Entry
        </Text>

      </TouchableOpacity>

      {/* LIST */}
      <FlatList
        data={history}
        keyExtractor={(item) =>
          item.id
        }
        contentContainerStyle={{
          paddingBottom: 40,
        }}
        renderItem={({ item }) => {

          const corr = correctionFor(item.id);
          const isPending = corr?.status === "PENDING";
          const isRejected = corr?.status === "REJECTED";
          const showCorrectionBtn =
            item.autoClosedByCron && !isPending;

          return (
          <View style={styles.card}>

            {/* TOP */}
            <View style={styles.topRow}>

              <View>

                <Text style={styles.date}>
                  {item.date}
                </Text>

                <Text style={styles.type}>
                  {
                    item.attendanceType
                  }
                </Text>

              </View>

              <View
                style={[

                  styles.badge,

                  item.status ===
                  "COMPLETED"

                    ? styles.completedBadge

                    : styles.activeBadge,
                ]}
              >

                <Text
                  style={styles.badgeText}
                >
                  {item.status}
                </Text>

              </View>

            </View>

            {/* FLAG BANNER */}
            {item.autoClosedByCron && (
              <View style={styles.flagBanner}>
                <Ionicons
                  name="alert-circle-outline"
                  size={16}
                  color="#fb923c"
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.flagTitle}>
                    Auto-closed at midnight
                  </Text>
                  <Text style={styles.flagSub}>
                    Looks like you forgot to check out.
                    {isPending
                      ? " Correction request pending HR review."
                      : isRejected && corr?.rejectionReason
                      ? ` Last request rejected: ${corr.rejectionReason}`
                      : isRejected
                      ? " Last correction was rejected."
                      : " Request a correction to set the right time."}
                  </Text>
                </View>
              </View>
            )}

            {showCorrectionBtn && (
              <TouchableOpacity
                style={styles.correctionBtn}
                onPress={() => openCorrection(item)}
              >
                <Ionicons
                  name="time-outline"
                  size={16}
                  color="#fff"
                />
                <Text style={styles.correctionBtnText}>
                  {isRejected
                    ? "Request again"
                    : "Request correction"}
                </Text>
              </TouchableOpacity>
            )}

            {/* CHECKIN */}
            <View style={styles.infoRow}>

              <Text style={styles.label}>
                Check In
              </Text>

              <Text style={styles.value}>

                {item.checkIn

                  ? new Date(
                      item.checkIn
                    ).toLocaleTimeString()

                  : "-"}

              </Text>

            </View>

            {/* CHECKOUT */}
            <View style={styles.infoRow}>

              <Text style={styles.label}>
                Check Out
              </Text>

              <Text style={styles.value}>

                {item.checkOut

                  ? new Date(
                      item.checkOut
                    ).toLocaleTimeString()

                  : "-"}

              </Text>

            </View>

            {/* NOTES */}
            <View style={styles.notesBox}>

              <Text style={styles.notesLabel}>
                Notes
              </Text>

              <Text style={styles.notes}>
                {item.workNotes ||
                  "No notes"}
              </Text>

            </View>

            {/* ACTIONS */}
            <View style={styles.actions}>

              <TouchableOpacity
                style={styles.editBtn}
                onPress={() =>
                  openEdit(item)
                }
              >

                <Ionicons
                  name="create-outline"
                  size={18}
                  color="#fff"
                />

                <Text style={styles.btnText}>
                  Edit
                </Text>

              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() =>
                  handleDelete(
                    item.id
                  )
                }
              >

                <Ionicons
                  name="trash-outline"
                  size={18}
                  color="#fff"
                />

                <Text style={styles.btnText}>
                  Delete
                </Text>

              </TouchableOpacity>

            </View>

          </View>
          );
        }}
      />

      {/* EDIT MODAL */}
      <Modal
        visible={editVisible}
        transparent
        animationType="slide"
      >

        <View style={styles.modalOverlay}>

          <View style={styles.modalContent}>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >

              <Text style={styles.modalTitle}>
                Edit Attendance
              </Text>

              {/* TYPE */}
              <Text style={styles.modalLabel}>
                Attendance Type
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

                      editType ===
                        item &&
                        styles.activeType,
                    ]}
                    onPress={() =>
                      setEditType(
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

              {/* TIMES */}
              {(editType === "OFFICE" ||
                editType === "WFH") && (
                <>

                  <Text style={styles.modalLabel}>
                    Work Hours
                  </Text>

                  {/* CHECK IN */}
                  {isWeb ? (
                    <View style={styles.timeRow}>

                      <View
                        style={[
                          styles.timeIcon,
                          { backgroundColor: "#16a34a" },
                        ]}
                      >
                        <Ionicons
                          name="log-in-outline"
                          size={18}
                          color="#fff"
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.timeLabel}>
                          Check In
                        </Text>
                        <WebDateField
                          mode="time"
                          value={
                            editCheckIn
                              ? dateToHM(editCheckIn)
                              : ""
                          }
                          onChange={(v) => {
                            const d = hmToDate(v);
                            if (d) setEditCheckIn(d);
                          }}
                        />
                      </View>

                    </View>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.timeRow}
                        onPress={() =>
                          setShowInPicker(true)
                        }
                        activeOpacity={0.8}
                      >

                        <View
                          style={[
                            styles.timeIcon,
                            { backgroundColor: "#16a34a" },
                          ]}
                        >
                          <Ionicons
                            name="log-in-outline"
                            size={18}
                            color="#fff"
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.timeLabel}>
                            Check In
                          </Text>
                          <Text
                            style={[
                              styles.timeValue,
                              !editCheckIn &&
                                styles.timePlaceholder,
                            ]}
                          >
                            {editCheckIn
                              ? formatTime(editCheckIn)
                              : "Tap to set"}
                          </Text>
                        </View>

                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color="#64748b"
                        />

                      </TouchableOpacity>

                      {showInPicker && (
                        <DateTimePicker
                          value={editCheckIn || new Date()}
                          mode="time"
                          onChange={(_, selected) => {
                            setShowInPicker(
                              Platform.OS === "ios"
                            );
                            if (selected)
                              setEditCheckIn(selected);
                          }}
                        />
                      )}
                    </>
                  )}

                  {/* CHECK OUT */}
                  {isWeb ? (
                    <View style={styles.timeRow}>

                      <View
                        style={[
                          styles.timeIcon,
                          { backgroundColor: "#dc2626" },
                        ]}
                      >
                        <Ionicons
                          name="log-out-outline"
                          size={18}
                          color="#fff"
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.timeLabel}>
                          Check Out
                        </Text>
                        <WebDateField
                          mode="time"
                          value={
                            editCheckOut
                              ? dateToHM(editCheckOut)
                              : ""
                          }
                          onChange={(v) => {
                            const d = hmToDate(v);
                            if (d) setEditCheckOut(d);
                          }}
                        />
                      </View>

                    </View>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.timeRow}
                        onPress={() =>
                          setShowOutPicker(true)
                        }
                        activeOpacity={0.8}
                      >

                        <View
                          style={[
                            styles.timeIcon,
                            { backgroundColor: "#dc2626" },
                          ]}
                        >
                          <Ionicons
                            name="log-out-outline"
                            size={18}
                            color="#fff"
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.timeLabel}>
                            Check Out
                          </Text>
                          <Text
                            style={[
                              styles.timeValue,
                              !editCheckOut &&
                                styles.timePlaceholder,
                            ]}
                          >
                            {editCheckOut
                              ? formatTime(editCheckOut)
                              : "Tap to set"}
                          </Text>
                        </View>

                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color="#64748b"
                        />

                      </TouchableOpacity>

                      {showOutPicker && (
                        <DateTimePicker
                          value={editCheckOut || new Date()}
                          mode="time"
                          onChange={(_, selected) => {
                            setShowOutPicker(
                              Platform.OS === "ios"
                            );
                            if (selected)
                              setEditCheckOut(selected);
                          }}
                        />
                      )}
                    </>
                  )}

                </>
              )}

              {/* NOTES */}
              <Text style={styles.modalLabel}>
                Notes
              </Text>

              <TextInput
                style={styles.input}
                value={editNotes}
                onChangeText={
                  setEditNotes
                }
                multiline
                placeholder="Enter notes"
                placeholderTextColor="#64748b"
              />

              {/* ACTIONS */}
              <View style={styles.modalActions}>

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() =>
                    setEditVisible(
                      false
                    )
                  }
                >

                  <Text
                    style={
                      styles.modalBtnText
                    }
                  >
                    Cancel
                  </Text>

                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={saveEdit}
                >

                  <Text
                    style={
                      styles.modalBtnText
                    }
                  >
                    Save
                  </Text>

                </TouchableOpacity>

              </View>

            </ScrollView>

          </View>

        </View>

      </Modal>

      {/* CORRECTION MODAL */}
      <Modal
        visible={corrVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCorrVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >

              <Text style={styles.modalTitle}>
                Request Correction
              </Text>

              <Text style={styles.corrHint}>
                {corrItem?.date}
                {"  ·  "}
                Auto-closed at midnight. Tell HR your real
                check-out time and why.
              </Text>

              <Text style={styles.modalLabel}>
                Actual Check-out Time
              </Text>

              {isWeb ? (
                <View style={styles.timeRow}>
                  <View
                    style={[
                      styles.timeIcon,
                      { backgroundColor: "#dc2626" },
                    ]}
                  >
                    <Ionicons
                      name="log-out-outline"
                      size={18}
                      color="#fff"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timeLabel}>
                      Check Out
                    </Text>
                    <WebDateField
                      mode="time"
                      value={
                        corrCheckOut
                          ? dateToHM(corrCheckOut)
                          : ""
                      }
                      onChange={(v) => {
                        const d = hmToDate(v);
                        if (d) setCorrCheckOut(d);
                      }}
                    />
                  </View>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.timeRow}
                    onPress={() => setCorrShowPicker(true)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.timeIcon,
                        { backgroundColor: "#dc2626" },
                      ]}
                    >
                      <Ionicons
                        name="log-out-outline"
                        size={18}
                        color="#fff"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.timeLabel}>
                        Check Out
                      </Text>
                      <Text
                        style={[
                          styles.timeValue,
                          !corrCheckOut &&
                            styles.timePlaceholder,
                        ]}
                      >
                        {corrCheckOut
                          ? corrCheckOut.toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })
                          : "Tap to set"}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color="#64748b"
                    />
                  </TouchableOpacity>
                  {corrShowPicker && (
                    <DateTimePicker
                      value={corrCheckOut || new Date()}
                      mode="time"
                      onChange={(_, d) => {
                        setCorrShowPicker(
                          Platform.OS === "ios"
                        );
                        if (d) setCorrCheckOut(d);
                      }}
                    />
                  )}
                </>
              )}

              <Text style={styles.modalLabel}>
                Reason
              </Text>

              <TextInput
                style={styles.input}
                value={corrReason}
                onChangeText={setCorrReason}
                multiline
                placeholder="Why did you forget to check out?"
                placeholderTextColor="#64748b"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setCorrVisible(false)}
                >
                  <Text style={styles.modalBtnText}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    corrSaving && { opacity: 0.7 },
                  ]}
                  onPress={submitCorrection}
                  disabled={corrSaving}
                >
                  {corrSaving ? (
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

    </View>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#0b1220",
    paddingHorizontal: 20,
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
    justifyContent: "space-between",
  },

  headerBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
  },

  manualBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 18,
    gap: 8,
  },

  manualBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  card: {
    backgroundColor: "#111827",
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#1f2937",
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },

  flagBanner: {
    flexDirection: "row",
    backgroundColor: "rgba(251, 146, 60, 0.12)",
    borderColor: "rgba(251, 146, 60, 0.4)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 8,
    marginBottom: 12,
    alignItems: "flex-start",
  },

  flagTitle: {
    color: "#fb923c",
    fontWeight: "800",
    fontSize: 13,
  },

  flagSub: {
    color: "#fbbf24",
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },

  correctionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f59e0b",
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 14,
    gap: 6,
  },

  correctionBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },

  corrHint: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: -8,
    marginBottom: 14,
    lineHeight: 18,
  },

  date: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },

  type: {
    color: "#94a3b8",
    marginTop: 4,
    fontWeight: "600",
  },

  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },

  completedBadge: {
    backgroundColor: "#16a34a",
  },

  activeBadge: {
    backgroundColor: "#2563eb",
  },

  badgeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  label: {
    color: "#94a3b8",
    fontWeight: "600",
  },

  value: {
    color: "#fff",
    fontWeight: "700",
  },

  notesBox: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
  },

  notesLabel: {
    color: "#94a3b8",
    marginBottom: 8,
    fontWeight: "600",
  },

  notes: {
    color: "#e2e8f0",
    lineHeight: 22,
  },

  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
  },

  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    borderRadius: 12,
    width: "48%",
  },

  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dc2626",
    paddingVertical: 12,
    borderRadius: 12,
    width: "48%",
  },

  btnText: {
    color: "#fff",
    fontWeight: "700",
    marginLeft: 6,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 20,
  },

  modalContent: {
    backgroundColor: "#111827",
    borderRadius: 20,
    padding: 20,
    maxHeight: "90%",
  },

  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1e293b",
  },

  timeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  timeLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },

  timeValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },

  timePlaceholder: {
    color: "#64748b",
    fontWeight: "600",
  },

  modalTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 20,
  },

  modalLabel: {
    color: "#94a3b8",
    marginBottom: 10,
    fontWeight: "600",
  },

  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  typeBtn: {
    width: "48%",
    backgroundColor: "#1f2937",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },

  activeType: {
    backgroundColor: "#2563eb",
  },

  typeText: {
    color: "#fff",
    fontWeight: "700",
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

  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },

  cancelBtn: {
    width: "48%",
    backgroundColor: "#374151",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },

  saveBtn: {
    width: "48%",
    backgroundColor: "#16a34a",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },

  modalBtnText: {
    color: "#fff",
    fontWeight: "700",
  },

});