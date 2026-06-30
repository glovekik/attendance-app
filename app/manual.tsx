import React, { useState, useMemo} from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform } from "react-native";
import { KbAwareScroll } from "../src/components/KbAwareScroll";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  useRouter,
  useLocalSearchParams } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import DateTimePicker from "@react-native-community/datetimepicker";

import {
  WebDateField,
  dateToYMD,
  dateToHM,
  ymdToDate,
  hmToDate } from "../src/components/WebDateField";

import { addManualEntry } from "../src/services/api";

import { useTheme } from "../src/theme/ThemeProvider";
const isWeb = Platform.OS === "web";

const TYPES = ["OFFICE", "WFH", "LEAVE", "HOLIDAY"];

export default function Manual() {

  const router = useRouter();

  const { theme } = useTheme();

  const c = theme.colors;

  const styles = useMemo(() => makeStyles(c), [c]);

  const params = useLocalSearchParams();

  const isEdit = params.edit === "true";

  // ================= INITIAL =================
  const initialDate = params.date
    ? new Date(`${params.date}T00:00:00`)
    : new Date();

  const initialCheckIn = params.checkIn
    ? new Date(params.checkIn as string)
    : null;

  const initialCheckOut = params.checkOut
    ? new Date(params.checkOut as string)
    : null;

  const initialType = TYPES.includes(params.type as string)
    ? (params.type as string)
    : "OFFICE";

  // ================= STATE =================
  const [date, setDate] = useState<Date>(initialDate);

  const [checkInTime, setCheckInTime] =
    useState<Date | null>(initialCheckIn);

  const [checkOutTime, setCheckOutTime] =
    useState<Date | null>(initialCheckOut);

  const [type, setType] = useState<string>(initialType);

  const [notes, setNotes] = useState(
    (params.notes as string) || ""
  );

  const [saving, setSaving] = useState(false);

  const [showDate, setShowDate] = useState(false);
  const [showIn, setShowIn] = useState(false);
  const [showOut, setShowOut] = useState(false);

  const [popup, setPopup] = useState({
    visible: false,
    type: "success" as "success" | "error",
    message: "" });

  // ================= POPUP =================
  const showPopup = (
    msg: string,
    kind: "success" | "error" = "success"
  ) => {
    setPopup({ visible: true, type: kind, message: msg });

    setTimeout(() => {
      setPopup((p) => ({ ...p, visible: false }));
    }, 2500);
  };

  // ================= FORMAT =================
  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric" });

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true });

  const dateOnly = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const combine = (d: Date, t: Date) => {
    const out = new Date(d);
    out.setHours(t.getHours(), t.getMinutes(), 0, 0);
    return out.toISOString();
  };

  const requiresTime = type === "OFFICE" || type === "WFH";

  // ================= SAVE =================
  const handleSave = async () => {

    if (saving) return;

    if (requiresTime) {

      if (!checkInTime) {
        showPopup("Please select check-in time", "error");
        return;
      }

      if (!checkOutTime) {
        showPopup("Please select check-out time", "error");
        return;
      }

      const inMins =
        checkInTime.getHours() * 60 + checkInTime.getMinutes();

      const outMins =
        checkOutTime.getHours() * 60 + checkOutTime.getMinutes();

      if (outMins <= inMins) {
        showPopup("Check-out must be after check-in", "error");
        return;
      }
    }

    if (!notes.trim()) {
      showPopup("Please enter work notes", "error");
      return;
    }

    try {

      setSaving(true);

      const token = await AsyncStorage.getItem("token");

      if (!token) {
        router.replace("/login");
        return;
      }

      const payload = {
        date: dateOnly(date),

        checkIn: requiresTime && checkInTime
          ? combine(date, checkInTime)
          : null,

        checkOut: requiresTime && checkOutTime
          ? combine(date, checkOutTime)
          : null,

        workNotes: notes.trim(),

        attendanceType: type };

      await addManualEntry(token, payload);

      showPopup(
        isEdit
          ? "Attendance updated"
          : "Attendance saved",
        "success"
      );

      setTimeout(() => {
        router.replace("/history");
      }, 800);

    } catch (err: any) {

      console.log(err);

      showPopup(
        err?.message || "Failed to save entry",
        "error"
      );

    } finally {
      setSaving(false);
    }
  };

  return (

    <SafeAreaView style={styles.safe}>

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

      <KbAwareScroll
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >

        {/* HEADER */}
        <View style={styles.header}>

          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color={c.text}
            />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>

            <Text style={styles.title}>
              {isEdit ? "Edit Entry" : "Manual Entry"}
            </Text>

            <Text style={styles.subtitle}>
              {isEdit
                ? "Update an existing record"
                : "Record attendance for a past day"}
            </Text>

          </View>

        </View>

        {/* DATE */}
        <Text style={styles.section}>DATE</Text>

        {isWeb ? (
          <View style={styles.row}>

            <View style={styles.rowIcon}>
              <Ionicons
                name="calendar-outline"
                size={20}
                color="#fff"
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>
                Date
              </Text>
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

          </View>
        ) : (
          <>
            <TouchableOpacity
              style={styles.row}
              onPress={() => setShowDate(true)}
              activeOpacity={0.8}
            >

              <View style={styles.rowIcon}>
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color="#fff"
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>
                  Date
                </Text>
                <Text style={styles.rowValue}>
                  {formatDate(date)}
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={20}
                color={c.textMuted}
              />

            </TouchableOpacity>

            {showDate && (
              <DateTimePicker
                value={date}
                mode="date"
                maximumDate={new Date()}
                onChange={(_, selected) => {
                  setShowDate(Platform.OS === "ios");
                  if (selected) setDate(selected);
                }}
              />
            )}
          </>
        )}

        {/* TYPE */}
        <Text style={styles.section}>
          ATTENDANCE TYPE
        </Text>

        <View style={styles.typeGrid}>

          {TYPES.map((t) => (
            <TouchableOpacity
              key={t}
              style={[
                styles.typeBtn,
                type === t && styles.activeType,
              ]}
              onPress={() => setType(t)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.typeText,
                  type === t && styles.activeTypeText,
                ]}
              >
                {t}
              </Text>
            </TouchableOpacity>
          ))}

        </View>

        {/* TIMES */}
        {requiresTime && (
          <>

            <Text style={styles.section}>
              WORK HOURS
            </Text>

            {/* CHECK IN */}
            {isWeb ? (
              <View style={styles.row}>

                <View
                  style={[
                    styles.rowIcon,
                    { backgroundColor: c.successBg },
                  ]}
                >
                  <Ionicons
                    name="log-in-outline"
                    size={20}
                    color={c.successText}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>
                    Check In
                  </Text>
                  <WebDateField
                    mode="time"
                    value={
                      checkInTime
                        ? dateToHM(checkInTime)
                        : ""
                    }
                    onChange={(v) => {
                      const d = hmToDate(v);
                      if (d) setCheckInTime(d);
                    }}
                  />
                </View>

              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => setShowIn(true)}
                  activeOpacity={0.8}
                >

                  <View
                    style={[
                      styles.rowIcon,
                      { backgroundColor: c.successBg },
                    ]}
                  >
                    <Ionicons
                      name="log-in-outline"
                      size={20}
                      color={c.successText}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>
                      Check In
                    </Text>
                    <Text
                      style={[
                        styles.rowValue,
                        !checkInTime && styles.rowValuePlaceholder,
                      ]}
                    >
                      {checkInTime
                        ? formatTime(checkInTime)
                        : "Tap to set"}
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={c.textMuted}
                  />

                </TouchableOpacity>

                {showIn && (
                  <DateTimePicker
                    value={checkInTime || new Date()}
                    mode="time"
                    onChange={(_, selected) => {
                      setShowIn(Platform.OS === "ios");
                      if (selected) setCheckInTime(selected);
                    }}
                  />
                )}
              </>
            )}

            {/* CHECK OUT */}
            {isWeb ? (
              <View style={styles.row}>

                <View
                  style={[
                    styles.rowIcon,
                    { backgroundColor: c.dangerBg },
                  ]}
                >
                  <Ionicons
                    name="log-out-outline"
                    size={20}
                    color={c.dangerText}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>
                    Check Out
                  </Text>
                  <WebDateField
                    mode="time"
                    value={
                      checkOutTime
                        ? dateToHM(checkOutTime)
                        : ""
                    }
                    onChange={(v) => {
                      const d = hmToDate(v);
                      if (d) setCheckOutTime(d);
                    }}
                  />
                </View>

              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => setShowOut(true)}
                  activeOpacity={0.8}
                >

                  <View
                    style={[
                      styles.rowIcon,
                      { backgroundColor: c.dangerBg },
                    ]}
                  >
                    <Ionicons
                      name="log-out-outline"
                      size={20}
                      color={c.dangerText}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>
                      Check Out
                    </Text>
                    <Text
                      style={[
                        styles.rowValue,
                        !checkOutTime && styles.rowValuePlaceholder,
                      ]}
                    >
                      {checkOutTime
                        ? formatTime(checkOutTime)
                        : "Tap to set"}
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={c.textMuted}
                  />

                </TouchableOpacity>

                {showOut && (
                  <DateTimePicker
                    value={checkOutTime || new Date()}
                    mode="time"
                    onChange={(_, selected) => {
                      setShowOut(Platform.OS === "ios");
                      if (selected) setCheckOutTime(selected);
                    }}
                  />
                )}
              </>
            )}

          </>
        )}

        {/* NOTES */}
        <Text style={styles.section}>NOTES</Text>

        <TextInput
          style={styles.notesInput}
          placeholder="What did you work on this day?"
          placeholderTextColor={c.textFaint}
          multiline
          value={notes}
          onChangeText={setNotes}
        />

        {/* SAVE */}
        <TouchableOpacity
          style={[
            styles.saveBtn,
            saving && styles.saveBtnDisabled,
          ]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >

          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons
                name={
                  isEdit
                    ? "checkmark-circle-outline"
                    : "save-outline"
                }
                size={20}
                color="#fff"
              />
              <Text style={styles.saveText}>
                {isEdit ? "Update Entry" : "Save Entry"}
              </Text>
            </>
          )}

        </TouchableOpacity>

      </KbAwareScroll>

    </SafeAreaView>
  );
}

const makeStyles = (c: any) => StyleSheet.create({

  safe: {
    flex: 1,
    backgroundColor: c.bg },

  container: {
    flex: 1 },

  content: {
    padding: 20,
    paddingBottom: 60 },

  popup: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    padding: 14,
    borderRadius: 14,
    zIndex: 999 },

  successPopup: {
    backgroundColor: "#16a34a" },

  errorPopup: {
    backgroundColor: "#dc2626" },

  popupText: {
    color: c.text,
    fontWeight: "700",
    textAlign: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    marginTop: 10,
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

  title: {
    color: c.text,
    fontSize: 24,
    fontWeight: "800" },

  subtitle: {
    color: c.textMuted,
    fontSize: 13,
    marginTop: 3 },

  section: {
    color: c.textMuted,
    fontSize: 12,
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 18,
    fontWeight: "700" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder },

  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: c.accent,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12 },

  rowLabel: {
    color: c.textMuted,
    fontSize: 12,
    fontWeight: "600" },

  rowValue: {
    color: c.text,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 2 },

  rowValuePlaceholder: {
    color: c.textMuted,
    fontWeight: "600" },

  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between" },

  typeBtn: {
    width: "48%",
    backgroundColor: c.surface,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    marginBottom: 10 },

  activeType: {
    backgroundColor: c.accent,
    borderColor: c.accent },

  typeText: {
    color: c.textMuted,
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.5 },

  activeTypeText: {
    color: "#fff" },

  notesInput: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    color: c.text,
    minHeight: 120,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    fontSize: 14,
    lineHeight: 20 },

  saveBtn: {
    marginTop: 26,
    backgroundColor: c.accent,
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    shadowColor: "#2563eb",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8 },

  saveBtnDisabled: {
    opacity: 0.6 },

  saveText: {
    color: c.text,
    fontWeight: "700",
    fontSize: 16 } });

