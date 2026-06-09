import React, { useCallback, useEffect, useState, useMemo} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Switch,
  Platform,
  RefreshControl } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter, useFocusEffect } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import { DatePickerField } from "../src/components/DatePickerField";

import {
  listLeaveTypes,
  getLeaveBalance,
  submitLeaveRequest,
  listMyLeaves,
  cancelLeaveRequest } from "../src/services/leaves";

import {
  LeaveType,
  LeaveBalance,
  LeaveRequest,
  HalfDayPart,
  User } from "../src/types";

import { useTheme } from "../src/theme/ThemeProvider";
import { getMe } from "../src/services/api";
import {
  BottomTabBar,
  BOTTOM_BAR_RESERVED_HEIGHT } from "../src/components/BottomTabBar";
import { confirmAction, notify } from "../src/utils/confirm";

/**
 * Leaves — balance cards (pastel-tinted), apply CTA, and a list of
 * request history with cancel for pending items.
 */
export default function MyLeaves() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  const [types, setTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [mine, setMine] = useState<LeaveRequest[]>([]);
  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Apply modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [typeCode, setTypeCode] = useState("");
  const [fromDate, setFromDate] = useState(dateYMD(new Date()));
  const [toDate, setToDate] = useState(dateYMD(new Date()));
  const [reason, setReason] = useState("");
  const [halfDay, setHalfDay] = useState(false);
  const [halfDayPart, setHalfDayPart] = useState<HalfDayPart>("FIRST");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const [t, b, m, meRes] = await Promise.all([
        listLeaveTypes(token).catch(() => [] as LeaveType[]),
        getLeaveBalance(token).catch(() => [] as LeaveBalance[]),
        listMyLeaves(token).catch(() => [] as LeaveRequest[]),
        getMe(token).catch(() => null),
      ]);
      setTypes(t || []);
      // Dedup balances by leaveTypeCode (DBs sometimes have duplicates).
      const seen = new Set<string>();
      const deduped: LeaveBalance[] = [];
      for (const bal of (b || [])) {
        if (!bal?.leaveTypeCode || seen.has(bal.leaveTypeCode)) continue;
        seen.add(bal.leaveTypeCode);
        deduped.push(bal);
      }
      setBalances(deduped);
      setMine(m || []);
      setMe(meRes);
    } catch (err: any) {
      notify("Couldn't load leaves", err?.message || "");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openApply = () => {
    if (types.length === 0) {
      notify("No leave types", "HR hasn't set up leave types yet.");
      return;
    }
    setTypeCode(types[0].code);
    setFromDate(dateYMD(new Date()));
    setToDate(dateYMD(new Date()));
    setReason("");
    setHalfDay(false);
    setHalfDayPart("FIRST");
    setSubmitError(null);
    setModalVisible(true);
  };

  const selectedType = types.find((t) => t.code === typeCode);

  const submit = async () => {
    if (saving) return;
    setSubmitError(null);
    if (!typeCode) return setSubmitError("Pick a leave type");
    if (!reason.trim()) return setSubmitError("Reason required");
    if (halfDay && fromDate !== toDate)
      return setSubmitError("Half-day must be a single date");
    if (toDate < fromDate)
      return setSubmitError("To date must be on or after from date");

    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await submitLeaveRequest(token, {
        leaveTypeCode: typeCode,
        fromDate,
        toDate,
        reason: reason.trim(),
        halfDay,
        halfDayPart: halfDay ? halfDayPart : undefined });
      notify("Submitted", "Your leave request has been sent.");
      setModalVisible(false);
      await load();
    } catch (err: any) {
      const msg =
        err?.status === 409
          ? "You already have a request that overlaps these dates."
          : err?.message || "Failed to submit";
      setSubmitError(msg);
    } finally {
      setSaving(false);
    }
  };

  const askCancel = async (req: LeaveRequest) => {
    const ok = await confirmAction({
      title: "Cancel request?",
      message: `${req.leaveTypeCode} · ${req.fromDate} → ${req.toDate}`,
      confirmLabel: "Cancel",
      destructive: true });
    if (!ok) return;
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await cancelLeaveRequest(token, req.id);
      await load();
    } catch (err: any) {
      notify("Cancel failed", err?.message || "");
    }
  };

  if (loading) {
    return (
      <View style={[styles.loader, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  // Pastel themes cycled across balance cards.
  const balanceTints = [
    { bg: c.pastelLavender, fg: "#6d28d9" },
    { bg: c.pastelMint, fg: "#15803d" },
    { bg: c.pastelPeach, fg: "#c2410c" },
    { bg: c.pastelPink, fg: "#be185d" },
    { bg: c.pastelSky, fg: "#0369a1" },
    { bg: c.pastelYellow, fg: "#a16207" },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: BOTTOM_BAR_RESERVED_HEIGHT + 24 }}
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
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/")
            }
            style={[
              styles.iconBtn,
              { backgroundColor: c.surface, borderColor: c.surfaceBorder },
            ]}
          >
            <Ionicons name="chevron-back" size={22} color={c.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.title, { color: c.text }]}>My Leaves</Text>
            <Text style={[styles.subtitle, { color: c.textMuted }]}>
              Balances & history
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.applyBtn,
              { backgroundColor: c.accent, shadowColor: c.shadow },
            ]}
            onPress={openApply}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* BALANCES */}
        <Text style={[styles.section, { color: c.textMuted }]}>BALANCE</Text>
        {balances.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: c.surface,
                borderColor: c.surfaceBorder,
                shadowColor: c.shadow },
            ]}
          >
            <Ionicons
              name="airplane-outline"
              size={28}
              color={c.textMuted}
            />
            <Text style={[styles.emptyText, { color: c.text }]}>
              {types.length === 0
                ? "HR hasn't set up any leave types yet."
                : "Your balance hasn't been allocated yet. Pull to refresh."}
            </Text>
          </View>
        ) : (
          <View style={styles.balanceGrid}>
            {balances.map((b, idx) => {
              const tint = balanceTints[idx % balanceTints.length];
              const allocated = Number(b.allocated ?? 0);
              const used = Number(b.used ?? 0);
              const pending = Number(b.pending ?? 0);
              const remaining = Number(
                b.remaining ?? allocated - used - pending
              );
              return (
                <View
                  key={b.leaveTypeCode}
                  style={[
                    styles.balanceCard,
                    {
                      backgroundColor: c.surface,
                      borderColor: c.surfaceBorder,
                      shadowColor: c.shadow },
                  ]}
                >
                  <View
                    style={[
                      styles.balanceIcon,
                      { backgroundColor: tint.bg },
                    ]}
                  >
                    <Ionicons
                      name="airplane-outline"
                      size={18}
                      color={tint.fg}
                    />
                  </View>
                  <Text
                    style={[styles.balanceName, { color: c.text }]}
                    numberOfLines={1}
                  >
                    {b.leaveType?.name || b.leaveTypeCode}
                  </Text>
                  <Text
                    style={[styles.balanceValue, { color: tint.fg }]}
                  >
                    {remaining}
                  </Text>
                  <Text
                    style={[styles.balanceSub, { color: c.textMuted }]}
                  >
                    of {allocated}
                  </Text>
                  <View style={styles.balanceFooter}>
                    <Text
                      style={[
                        styles.balanceFoot,
                        { color: c.textMuted },
                      ]}
                    >
                      Used {used}
                    </Text>
                    {pending > 0 && (
                      <Text
                        style={[
                          styles.balanceFoot,
                          { color: c.warningText },
                        ]}
                      >
                        Pending {pending}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* HISTORY */}
        <Text style={[styles.section, { color: c.textMuted }]}>
          MY REQUESTS
        </Text>
        {mine.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: c.surface,
                borderColor: c.surfaceBorder,
                shadowColor: c.shadow },
            ]}
          >
            <Ionicons name="time-outline" size={28} color={c.textMuted} />
            <Text style={[styles.emptyText, { color: c.text }]}>
              No leave requests yet.
            </Text>
            <Text style={[styles.emptySub, { color: c.textMuted }]}>
              Tap + to apply for leave.
            </Text>
          </View>
        ) : (
          mine.map((r) => (
            <RequestCard
              key={r.id}
              req={r}
              onCancel={() => askCancel(r)}
              theme={theme}
            />
          ))
        )}
      </ScrollView>

      {/* APPLY MODAL */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modalScrim, { backgroundColor: c.overlay }]}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: c.surface,
                shadowColor: c.shadow },
            ]}
          >
            <KeyboardAwareScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bottomOffset={24}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: c.text }]}>
                  Apply for leave
                </Text>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={22} color={c.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Leave type chips */}
              <Text style={[styles.label, { color: c.textMuted }]}>
                TYPE
              </Text>
              <View style={styles.chipsRow}>
                {types.map((t) => {
                  const active = typeCode === t.code;
                  return (
                    <TouchableOpacity
                      key={t.code}
                      onPress={() => setTypeCode(t.code)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active
                            ? c.accentSoft
                            : c.surfaceMuted,
                          borderColor: active
                            ? c.accent
                            : c.surfaceBorder },
                      ]}
                    >
                      <Text
                        style={{
                          color: active ? c.accent : c.textMuted,
                          fontWeight: "700",
                          fontSize: 12 }}
                      >
                        {t.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* From / To dates */}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: c.textMuted }]}>
                    FROM
                  </Text>
                  <DatePickerField
                    value={fromDate}
                    onChange={(v) => {
                      setFromDate(v);
                      if (toDate < v) setToDate(v);
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: c.textMuted }]}>
                    TO
                  </Text>
                  <DatePickerField
                    value={toDate}
                    onChange={setToDate}
                    min={fromDate}
                  />
                </View>
              </View>

              {/* Half day */}
              {selectedType?.allowHalfDay && (
                <>
                  <View style={styles.switchRow}>
                    <Text style={[styles.label, { color: c.textMuted }]}>
                      HALF DAY
                    </Text>
                    <Switch
                      value={halfDay}
                      onValueChange={setHalfDay}
                      trackColor={{
                        false: c.surfaceBorder,
                        true: c.accent }}
                    />
                  </View>
                  {halfDay && (
                    <View style={[styles.chipsRow, { marginTop: 4 }]}>
                      {(["FIRST", "SECOND"] as HalfDayPart[]).map((p) => {
                        const active = halfDayPart === p;
                        return (
                          <TouchableOpacity
                            key={p}
                            onPress={() => setHalfDayPart(p)}
                            style={[
                              styles.chip,
                              {
                                backgroundColor: active
                                  ? c.accentSoft
                                  : c.surfaceMuted,
                                borderColor: active
                                  ? c.accent
                                  : c.surfaceBorder },
                            ]}
                          >
                            <Text
                              style={{
                                color: active ? c.accent : c.textMuted,
                                fontWeight: "700",
                                fontSize: 12 }}
                            >
                              {p === "FIRST" ? "Morning" : "Afternoon"}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </>
              )}

              {/* Reason */}
              <Text style={[styles.label, { color: c.textMuted }]}>
                REASON
              </Text>
              <TextInput
                style={[
                  styles.textArea,
                  {
                    backgroundColor: c.surfaceMuted,
                    color: c.text,
                    borderColor: c.surfaceBorder },
                ]}
                value={reason}
                onChangeText={setReason}
                placeholder="Brief reason for your leave"
                placeholderTextColor={c.textFaint}
                multiline
                textAlignVertical="top"
              />

              {!!submitError && (
                <View
                  style={[
                    styles.errorBanner,
                    {
                      backgroundColor: c.dangerBg,
                      borderColor: c.dangerText },
                  ]}
                >
                  <Ionicons
                    name="alert-circle-outline"
                    size={16}
                    color={c.dangerText}
                  />
                  <Text
                    style={{
                      color: c.dangerText,
                      fontSize: 12,
                      fontWeight: "600",
                      flex: 1 }}
                  >
                    {submitError}
                  </Text>
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[
                    styles.cancelBtn,
                    { backgroundColor: c.surfaceMuted },
                  ]}
                  onPress={() => setModalVisible(false)}
                  disabled={saving}
                >
                  <Text
                    style={{ color: c.text, fontWeight: "700" }}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    {
                      backgroundColor: c.accent,
                      shadowColor: c.shadow,
                      opacity: saving ? 0.7 : 1 },
                  ]}
                  onPress={submit}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: "#fff", fontWeight: "800" }}>
                      Submit
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>

      <BottomTabBar user={me} />
    </SafeAreaView>
  );
}

function dateYMD(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const RequestCard = ({
  req,
  onCancel,
  theme }: {
  req: LeaveRequest;
  onCancel: () => void;
  theme: any;
}) => {
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  const statusMap: Record<string, { bg: string; fg: string }> = {
    APPROVED: { bg: c.successBg, fg: c.successText },
    REJECTED: { bg: c.dangerBg, fg: c.dangerText },
    CANCELLED: { bg: c.surfaceMuted, fg: c.textMuted },
    PENDING: { bg: c.warningBg, fg: c.warningText } };
  const tone = statusMap[req.status] || statusMap.PENDING;
  return (
    <View
      style={[
        styles.reqCard,
        {
          backgroundColor: c.surface,
          borderColor: c.surfaceBorder,
          shadowColor: c.shadow },
      ]}
    >
      <View style={styles.reqHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.reqType, { color: c.text }]}>
            {req.leaveType?.name || req.leaveTypeCode}
          </Text>
          <Text style={[styles.reqDates, { color: c.textMuted }]}>
            {req.fromDate}
            {req.fromDate !== req.toDate && ` → ${req.toDate}`}
            {req.halfDay && " · half day"}
            {`  ·  ${req.totalDays}d`}
          </Text>
        </View>
        <View
          style={[
            styles.statusPill,
            { backgroundColor: tone.bg },
          ]}
        >
          <Text style={{ color: tone.fg, fontSize: 10, fontWeight: "800" }}>
            {req.status}
          </Text>
        </View>
      </View>
      {!!req.reason && (
        <Text style={[styles.reqReason, { color: c.textMuted }]}>
          {req.reason}
        </Text>
      )}
      {req.note ? (
        <Text style={[styles.reqNote, { color: c.text }]}>
          HR note: {req.note}
        </Text>
      ) : null}
      {req.status === "PENDING" && (
        <TouchableOpacity
          style={styles.reqCancel}
          onPress={onCancel}
        >
          <Ionicons
            name="close-circle-outline"
            size={14}
            color={c.dangerText}
          />
          <Text
            style={{
              color: c.dangerText,
              fontSize: 12,
              fontWeight: "700" }}
          >
            Cancel request
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const makeStyles = (c: any) => StyleSheet.create({
  safe: { flex: 1 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    gap: 8 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "800" },
  subtitle: { fontSize: 13, marginTop: 2 },
  applyBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3 },

  section: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginTop: 18,
    marginBottom: 10,
    marginLeft: 4 },

  balanceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  balanceCard: {
    width: "47%",
    flexGrow: 1,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2 },
  balanceIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10 },
  balanceName: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  balanceValue: { fontSize: 30, fontWeight: "800" },
  balanceSub: { fontSize: 12, marginTop: 2 },
  balanceFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12 },
  balanceFoot: { fontSize: 11, fontWeight: "700" },

  emptyCard: {
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2 },
  emptyText: { fontSize: 14, fontWeight: "700", textAlign: "center" },
  emptySub: { fontSize: 12, textAlign: "center" },

  reqCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1 },
  reqHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  reqType: { fontSize: 15, fontWeight: "800" },
  reqDates: { fontSize: 12, marginTop: 3 },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999 },
  reqReason: { fontSize: 12, marginTop: 8, lineHeight: 17 },
  reqNote: { fontSize: 12, marginTop: 6, fontStyle: "italic" },
  reqCancel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10 },

  // Modal
  modalScrim: { flex: 1, justifyContent: "flex-end" },
  modalCard: {
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4 },
  modalTitle: { fontSize: 20, fontWeight: "800" },
  label: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 14,
    marginBottom: 6 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14 },
  textArea: {
    minHeight: 80,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 14 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12 },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
    marginBottom: Platform.OS === "ios" ? 10 : 0 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center" },
  submitBtn: {
    flex: 1.5,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3 } });
