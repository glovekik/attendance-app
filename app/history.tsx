import React, {
  useEffect,
  useMemo,
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
  getMe,
  deleteAttendance,
  updateAttendance,
} from "../src/services/api";

import {
  requestCorrection,
  listMyCorrections,
} from "../src/services/corrections";

import { AttendanceCorrection, User, hasRole } from "../src/types";
import { useTheme } from "../src/theme/ThemeProvider";

const isWeb = Platform.OS === "web";

export default function History() {

  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  const [loading, setLoading] =
    useState(true);

  const [history, setHistory] =
    useState<any[]>([]);

  const [me, setMe] = useState<User | null>(null);

  // Month filter for the table view — defaults to the current month
  // so the screen opens on "this month's attendance till date".
  const todayDate = new Date();
  const [filterYear, setFilterYear] = useState(todayDate.getFullYear());
  const [filterMonth, setFilterMonth] = useState(todayDate.getMonth() + 1);

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

  // Editable fields in the correction modal — every attendance field
  // is now editable. The "original" mirrors the current attendance row
  // so submit can diff and only send fields that actually changed.
  const [corrDate, setCorrDate] = useState<string>("");
  const [corrCheckIn, setCorrCheckIn] =
    useState<Date | null>(null);

  const [corrCheckOut, setCorrCheckOut] =
    useState<Date | null>(null);

  const [corrType, setCorrType] = useState<
    "OFFICE" | "WFH" | "LEAVE" | "HOLIDAY"
  >("OFFICE");

  const [corrNotes, setCorrNotes] = useState("");

  const [corrShowPicker, setCorrShowPicker] =
    useState(false);

  const [corrShowInPicker, setCorrShowInPicker] =
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

  const monthLabel = (y: number, m: number) =>
    new Date(y, m - 1, 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

  const goPrevMonth = () => {
    if (filterMonth === 1) {
      setFilterYear(filterYear - 1);
      setFilterMonth(12);
    } else {
      setFilterMonth(filterMonth - 1);
    }
  };

  const goNextMonth = () => {
    if (filterMonth === 12) {
      setFilterYear(filterYear + 1);
      setFilterMonth(1);
    } else {
      setFilterMonth(filterMonth + 1);
    }
  };

  const inSelectedMonth = (dateStr?: string) => {
    if (!dateStr) return false;
    const [yy, mm] = dateStr.split("-").map(Number);
    return yy === filterYear && mm === filterMonth;
  };

  const hoursBetween = (
    ci?: string | null,
    co?: string | null
  ): string => {
    if (!ci || !co) return "—";
    const diff =
      (new Date(co).getTime() - new Date(ci).getTime()) / 60000;
    if (diff <= 0 || Number.isNaN(diff)) return "—";
    const h = Math.floor(diff / 60);
    const m = Math.round(diff % 60);
    return `${h}h ${String(m).padStart(2, "0")}m`;
  };

  const shortTime = (iso?: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "—";
    }
  };

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

      const [histRes, corrRes, meRes] = await Promise.all([
        getHistory(token),
        listMyCorrections(token).catch(() => []),
        getMe(token).catch(() => null),
      ]);

      setHistory(histRes);
      setCorrections(corrRes || []);
      setMe(meRes);

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
    // Seed every editable field from the existing record so the user
    // sees the current values and only the ones they change get sent.
    setCorrItem(item);
    setCorrDate(item.date || "");
    setCorrCheckIn(item.checkIn ? new Date(item.checkIn) : null);
    setCorrCheckOut(item.checkOut ? new Date(item.checkOut) : null);
    setCorrType(item.attendanceType || "OFFICE");
    setCorrNotes(item.workNotes || "");
    setCorrReason("");
    setCorrVisible(true);
  };

  const submitCorrection = async () => {

    if (corrSaving || !corrItem) return;

    if (!corrReason.trim()) {
      showError({ message: "Please give a reason" });
      return;
    }

    try {
      setCorrSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      // Build the payload by diffing each editable field against the
      // original record. Only changed fields are sent. The base date
      // for combining check-in/out times is the corrected date (so
      // moving a record from one day to another carries the times).
      const baseDateStr = (corrDate || corrItem.date).trim();
      const baseDate = new Date(`${baseDateStr}T00:00:00`);
      const combineTime = (t: Date) => {
        const d = new Date(baseDate);
        d.setHours(t.getHours(), t.getMinutes(), 0, 0);
        return d.toISOString();
      };

      const body: any = { reason: corrReason.trim() };

      if (baseDateStr && baseDateStr !== corrItem.date) {
        body.requestedDate = baseDateStr;
      }

      const origIn = corrItem.checkIn ? new Date(corrItem.checkIn) : null;
      const origOut = corrItem.checkOut ? new Date(corrItem.checkOut) : null;
      const timeChanged = (a: Date | null, b: Date | null) => {
        if (!a && !b) return false;
        if (!a || !b) return true;
        return (
          a.getHours() !== b.getHours() ||
          a.getMinutes() !== b.getMinutes()
        );
      };

      if (corrCheckIn && (timeChanged(corrCheckIn, origIn) || baseDateStr !== corrItem.date)) {
        body.requestedCheckIn = combineTime(corrCheckIn);
      }
      if (corrCheckOut && (timeChanged(corrCheckOut, origOut) || baseDateStr !== corrItem.date)) {
        body.requestedCheckOut = combineTime(corrCheckOut);
      }

      if (corrType !== corrItem.attendanceType) {
        body.requestedAttendanceType = corrType;
      }

      if ((corrNotes || "") !== (corrItem.workNotes || "")) {
        body.requestedWorkNotes = corrNotes;
      }

      // Reason alone isn't a change — the backend will 400. Catch it
      // here with a friendlier message.
      const hasChange = Object.keys(body).some((k) => k !== "reason");
      if (!hasChange) {
        showError({
          message:
            "Change at least one field (date, check-in, check-out, type, or notes) before submitting.",
        });
        setCorrSaving(false);
        return;
      }

      await requestCorrection(token, corrItem.id, body);

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
          color={c.accent}
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
            (router.canGoBack() ? router.back() : router.replace("/"))
          }
        >

          <Ionicons
            name="chevron-back"
            size={22}
            color={c.text}
          />

        </TouchableOpacity>

        <Text style={styles.title}>
          Attendance History
        </Text>

        <View style={{ width: 42 }} />

      </View>

      {/* Manual entry is no longer surfaced here — employees raise a
          request via /manual-request, and HR/Manager approve from their
          own consoles. HR can still mark attendance for an employee from
          the HR Admin → Daily Attendance flow. */}

      {/* MONTH FILTER + TABLE */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={goPrevMonth} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={c.textMuted} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>
          {monthLabel(filterYear, filterMonth)}
        </Text>
        <TouchableOpacity onPress={goNextMonth} hitSlop={10}>
          <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.tableCard}>
        <View style={[styles.tableRow, styles.tableHead]}>
          <Text style={[styles.tableCell, styles.tableCellDate, styles.tableHeadText]}>
            Date
          </Text>
          <Text style={[styles.tableCell, styles.tableHeadText]}>Clock In</Text>
          <Text style={[styles.tableCell, styles.tableHeadText]}>Clock Out</Text>
          <Text style={[styles.tableCell, styles.tableHeadText]}>Total</Text>
        </View>

        {(() => {
          const monthRows = history.filter((r) => inSelectedMonth(r.date));
          if (monthRows.length === 0) {
            return (
              <View style={styles.tableEmpty}>
                <Text style={styles.tableEmptyText}>
                  No attendance recorded for {monthLabel(filterYear, filterMonth)}.
                </Text>
              </View>
            );
          }
          return monthRows.map((r) => (
            <View key={`tbl-${r.id}`} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.tableCellDate]}>
                {r.date}
              </Text>
              <Text style={styles.tableCell}>{shortTime(r.checkIn)}</Text>
              <Text style={styles.tableCell}>{shortTime(r.checkOut)}</Text>
              <Text style={[styles.tableCell, { color: "#22c55e" }]}>
                {hoursBetween(r.checkIn, r.checkOut)}
              </Text>
            </View>
          ));
        })()}
      </View>

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

            {/* ACTIONS — single bottom action row. HR can edit/delete
                directly; non-HR can request a correction (unless one is
                already pending). */}
            {hasRole(me, "HR") ? (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => openEdit(item)}
                >
                  <Ionicons
                    name="create-outline"
                    size={18}
                    color="#fff"
                  />
                  <Text style={styles.btnText}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(item.id)}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color="#fff"
                  />
                  <Text style={styles.btnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            ) : !isPending ? (
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
                    : showCorrectionBtn
                    ? "Request correction"
                    : "Request correction"}
                </Text>
              </TouchableOpacity>
            ) : null}

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
                          { backgroundColor: c.successBg },
                        ]}
                      >
                        <Ionicons
                          name="log-in-outline"
                          size={18}
                          color={c.successText}
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
                            { backgroundColor: c.successBg },
                          ]}
                        >
                          <Ionicons
                            name="log-in-outline"
                            size={18}
                            color={c.successText}
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
                          color={c.textMuted}
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
                          { backgroundColor: c.dangerBg },
                        ]}
                      >
                        <Ionicons
                          name="log-out-outline"
                          size={18}
                          color={c.dangerText}
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
                            { backgroundColor: c.dangerBg },
                          ]}
                        >
                          <Ionicons
                            name="log-out-outline"
                            size={18}
                            color={c.dangerText}
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
                          color={c.textMuted}
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
                placeholderTextColor={c.textFaint}
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
                Original: {corrItem?.date}
                {"  ·  "}
                {corrItem?.attendanceType || "—"}
                {"\n"}
                Change any field below. Manager/HR approves before the
                change is applied.
              </Text>

              {/* DATE */}
              <Text style={styles.modalLabel}>Date</Text>
              {isWeb ? (
                <View style={styles.timeRow}>
                  <View
                    style={[
                      styles.timeIcon,
                      { backgroundColor: c.infoBg },
                    ]}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color={c.infoText}
                    />
                  </View>
                  <WebDateField
                    mode="date"
                    value={corrDate}
                    onChange={(v) => v && setCorrDate(v)}
                  />
                </View>
              ) : (
                <View style={styles.timeRow}>
                  <View
                    style={[
                      styles.timeIcon,
                      { backgroundColor: c.infoBg },
                    ]}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color={c.infoText}
                    />
                  </View>
                  <TextInput
                    style={[styles.input, { flex: 1, marginTop: 0 }]}
                    value={corrDate}
                    onChangeText={setCorrDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={c.textFaint}
                    autoCapitalize="none"
                  />
                </View>
              )}

              {/* TYPE */}
              <Text style={styles.modalLabel}>Attendance Type</Text>
              <View style={styles.typeRow}>
                {(["OFFICE", "WFH", "LEAVE", "HOLIDAY"] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.typeChip,
                      corrType === t && styles.typeChipActive,
                    ]}
                    onPress={() => setCorrType(t)}
                  >
                    <Text
                      style={[
                        styles.typeChipText,
                        corrType === t && styles.typeChipTextActive,
                      ]}
                    >
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* CHECK-IN */}
              <Text style={styles.modalLabel}>Check-in Time</Text>
              {isWeb ? (
                <View style={styles.timeRow}>
                  <View
                    style={[
                      styles.timeIcon,
                      { backgroundColor: c.successBg },
                    ]}
                  >
                    <Ionicons
                      name="log-in-outline"
                      size={18}
                      color={c.successText}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timeLabel}>Check In</Text>
                    <WebDateField
                      mode="time"
                      value={corrCheckIn ? dateToHM(corrCheckIn) : ""}
                      onChange={(v) => {
                        const d = hmToDate(v);
                        if (d) setCorrCheckIn(d);
                      }}
                    />
                  </View>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.timeRow}
                    onPress={() => setCorrShowInPicker(true)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.timeIcon,
                        { backgroundColor: c.successBg },
                      ]}
                    >
                      <Ionicons
                        name="log-in-outline"
                        size={18}
                        color={c.successText}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.timeLabel}>Check In</Text>
                      <Text
                        style={[
                          styles.timeValue,
                          !corrCheckIn && styles.timePlaceholder,
                        ]}
                      >
                        {corrCheckIn
                          ? corrCheckIn.toLocaleTimeString([], {
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
                      color={c.textMuted}
                    />
                  </TouchableOpacity>
                  {corrShowInPicker && (
                    <DateTimePicker
                      value={corrCheckIn || new Date()}
                      mode="time"
                      onChange={(_, d) => {
                        setCorrShowInPicker(
                          Platform.OS === "ios"
                        );
                        if (d) setCorrCheckIn(d);
                      }}
                    />
                  )}
                </>
              )}

              {/* CHECK-OUT */}
              <Text style={styles.modalLabel}>Check-out Time</Text>

              {isWeb ? (
                <View style={styles.timeRow}>
                  <View
                    style={[
                      styles.timeIcon,
                      { backgroundColor: c.dangerBg },
                    ]}
                  >
                    <Ionicons
                      name="log-out-outline"
                      size={18}
                      color={c.dangerText}
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
                        { backgroundColor: c.dangerBg },
                      ]}
                    >
                      <Ionicons
                        name="log-out-outline"
                        size={18}
                        color={c.dangerText}
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
                      color={c.textMuted}
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

              {/* WORK NOTES */}
              <Text style={styles.modalLabel}>Work Notes</Text>
              <TextInput
                style={styles.input}
                value={corrNotes}
                onChangeText={setCorrNotes}
                multiline
                placeholder="What did you do that day?"
                placeholderTextColor={c.textFaint}
              />

              {/* REASON */}
              <Text style={styles.modalLabel}>
                Reason for correction *
              </Text>

              <TextInput
                style={styles.input}
                value={corrReason}
                onChangeText={setCorrReason}
                multiline
                placeholder="Why does this record need to change?"
                placeholderTextColor={c.textFaint}
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
                    <Text style={[styles.modalBtnText, { color: "#fff" }]}>
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

const makeStyles = (c: any) => StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: c.bg,
    paddingHorizontal: 20,
  },

  loader: {
    flex: 1,
    backgroundColor: c.bg,
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
    color: c.text,
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
    backgroundColor: c.surface,
    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    color: c.text,
    fontSize: 22,
    fontWeight: "800",
  },

  manualBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.accent,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 18,
    gap: 8,
  },

  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: c.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    marginBottom: 12,
  },
  monthLabel: {
    color: c.text,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  tableCard: {
    backgroundColor: c.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    overflow: "hidden",
    marginBottom: 18,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceBorder,
    alignItems: "center",
  },
  tableHead: {
    backgroundColor: c.surfaceMuted,
  },
  tableCell: {
    flex: 1,
    color: c.text,
    fontSize: 12,
    fontWeight: "600",
  },
  tableCellDate: {
    flex: 1.2,
    color: c.text,
    fontWeight: "700",
  },
  tableHeadText: {
    color: c.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  tableEmpty: {
    padding: 18,
    alignItems: "center",
  },
  tableEmptyText: {
    color: c.textMuted,
    fontSize: 12,
    textAlign: "center",
  },

  manualBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  card: {
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
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
    color: c.textMuted,
    fontSize: 13,
    marginTop: -8,
    marginBottom: 14,
    lineHeight: 18,
  },

  date: {
    color: c.text,
    fontSize: 18,
    fontWeight: "700",
  },

  type: {
    color: c.textMuted,
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
    backgroundColor: c.accent,
  },

  badgeText: {
    color: c.text,
    fontWeight: "700",
    fontSize: 12,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  label: {
    color: c.textMuted,
    fontWeight: "600",
  },

  value: {
    color: c.text,
    fontWeight: "700",
  },

  notesBox: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: c.surfaceBorder,
  },

  notesLabel: {
    color: c.textMuted,
    marginBottom: 8,
    fontWeight: "600",
  },

  notes: {
    color: c.text,
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
    backgroundColor: c.accent,
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
    color: c.text,
    fontWeight: "700",
    marginLeft: 6,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: c.overlay,
    justifyContent: "center",
    padding: 20,
  },

  modalContent: {
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 20,
    maxHeight: "90%",
  },

  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surfaceMuted,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    gap: 8,
  },

  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
    marginTop: 4,
  },

  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
  },

  typeChipActive: {
    backgroundColor: c.accent,
    borderColor: c.accent,
  },

  typeChipText: {
    color: c.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },

  typeChipTextActive: { color: c.text },

  timeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  timeLabel: {
    color: c.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },

  timeValue: {
    color: c.text,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },

  timePlaceholder: {
    color: c.textMuted,
    fontWeight: "600",
  },

  modalTitle: {
    color: c.text,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 20,
  },

  modalLabel: {
    color: c.textMuted,
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
    backgroundColor: c.surfaceMuted,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },

  activeType: {
    backgroundColor: c.accent,
  },

  typeText: {
    color: c.text,
    fontWeight: "700",
  },

  input: {
    backgroundColor: c.surfaceMuted,
    borderRadius: 12,
    padding: 14,
    color: c.text,
    minHeight: 120,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: c.surfaceBorder,
  },

  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },

  cancelBtn: {
    width: "48%",
    backgroundColor: c.surfaceMuted,
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
    color: c.text,
    fontWeight: "700",
  },

});

