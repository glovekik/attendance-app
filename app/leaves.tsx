import React, { useCallback, useEffect, useState, useMemo } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Switch,
  Platform,
  RefreshControl,
  Pressable,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter, useFocusEffect } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import { DatePickerField } from "../src/components/DatePickerField";
import { WebModal, ModalActions } from "../src/components/WebModal";
import { PageHeader } from "../src/components/PageHeader";
import { ProButton } from "../src/components/ProUI";
import { FormField, ChipPicker } from "../src/components/WebFormFields";

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
  User,
} from "../src/types";

import { useTheme } from "../src/theme/ThemeProvider";
import { getMe } from "../src/services/api";
import {
  BottomTabBar,
  BOTTOM_BAR_RESERVED_HEIGHT,
} from "../src/components/BottomTabBar";
import { confirmAction, notify } from "../src/utils/confirm";
import { useResponsive, getResponsiveSpacing } from "../src/utils/responsive";

/**
 * Leaves — balance cards (pastel-tinted), apply CTA, and a list of
 * request history with cancel for pending items.
 */
export default function MyLeaves() {
  const router = useRouter();
  const { theme } = useTheme();
  const responsive = useResponsive();
  const spacing = getResponsiveSpacing(responsive.breakpoint);
  const isDesktop = responsive.isDesktop;
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c, isDesktop), [c, isDesktop]);

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

  // Desktop shows sidebar, so we don't need bottom bar padding
  const bottomPadding = responsive.showSidebar ? 40 : BOTTOM_BAR_RESERVED_HEIGHT + 24;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.padding,
          paddingBottom: bottomPadding,
          ...(isDesktop && {
            maxWidth: 1200,
            alignSelf: "center" as const,
            width: "100%",
          }),
        }}
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
        {/* HEADER - Desktop uses PageHeader with breadcrumbs */}
        {isDesktop ? (
          <PageHeader
            title="My Leaves"
            subtitle="View balances & request history"
            breadcrumbs={[
              { label: "Home", href: "/" },
              { label: "Leaves" },
            ]}
            actions={
              <ProButton
                label="Apply for Leave"
                icon="add"
                onPress={openApply}
                variant="primary"
              />
            }
          />
        ) : (
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
        )}

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
              isDesktop={isDesktop}
            />
          ))
        )}
      </ScrollView>

      {/* APPLY MODAL */}
      <WebModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Apply for Leave"
        subtitle="Submit a new leave request"
        size="md"
        footer={
          <ModalActions align="spread">
            <ProButton
              label="Cancel"
              variant="secondary"
              onPress={() => setModalVisible(false)}
              disabled={saving}
            />
            <ProButton
              label={saving ? "Submitting..." : "Submit Request"}
              variant="primary"
              onPress={submit}
              loading={saving}
              icon="checkmark"
            />
          </ModalActions>
        }
      >
        <KeyboardAwareScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bottomOffset={24}
        >
          {/* Leave type chips */}
          <FormField label="Leave Type" required>
            <ChipPicker
              value={typeCode}
              onChange={(v) => setTypeCode(v as string)}
              options={types.map((t) => ({
                value: t.code,
                label: t.name,
              }))}
            />
          </FormField>

          {/* From / To dates */}
          <View style={{ flexDirection: "row", gap: isDesktop ? 16 : 8 }}>
            <View style={{ flex: 1 }}>
              <FormField label="From Date" required>
                <DatePickerField
                  value={fromDate}
                  onChange={(v) => {
                    setFromDate(v);
                    if (toDate < v) setToDate(v);
                  }}
                />
              </FormField>
            </View>
            <View style={{ flex: 1 }}>
              <FormField label="To Date" required>
                <DatePickerField
                  value={toDate}
                  onChange={setToDate}
                  min={fromDate}
                />
              </FormField>
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
                    true: c.accent,
                  }}
                />
              </View>
              {halfDay && (
                <FormField label="Half Day Part">
                  <ChipPicker
                    value={halfDayPart}
                    onChange={(v) => setHalfDayPart(v as HalfDayPart)}
                    options={[
                      { value: "FIRST", label: "Morning" },
                      { value: "SECOND", label: "Afternoon" },
                    ]}
                  />
                </FormField>
              )}
            </>
          )}

          {/* Reason */}
          <FormField label="Reason" required>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: c.surfaceMuted,
                  color: c.text,
                  borderColor: c.surfaceBorder,
                },
              ]}
              value={reason}
              onChangeText={setReason}
              placeholder="Brief reason for your leave"
              placeholderTextColor={c.textFaint}
              multiline
              textAlignVertical="top"
            />
          </FormField>

          {!!submitError && (
            <View
              style={[
                styles.errorBanner,
                {
                  backgroundColor: c.dangerBg,
                  borderColor: c.dangerText,
                },
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
                  flex: 1,
                }}
              >
                {submitError}
              </Text>
            </View>
          )}
        </KeyboardAwareScrollView>
      </WebModal>

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
  theme,
  isDesktop = false,
}: {
  req: LeaveRequest;
  onCancel: () => void;
  theme: any;
  isDesktop?: boolean;
}) => {
  const c = theme.colors;
  const statusMap: Record<string, { bg: string; fg: string }> = {
    APPROVED: { bg: c.successBg, fg: c.successText },
    REJECTED: { bg: c.dangerBg, fg: c.dangerText },
    CANCELLED: { bg: c.surfaceMuted, fg: c.textMuted },
    PENDING: { bg: c.warningBg, fg: c.warningText },
  };
  const tone = statusMap[req.status] || statusMap.PENDING;

  return (
    <Pressable
      style={({ hovered }: any) => [
        {
          padding: isDesktop ? 18 : 14,
          borderRadius: 16,
          borderWidth: 1,
          marginBottom: 10,
          backgroundColor: c.surface,
          borderColor: c.surfaceBorder,
          shadowColor: c.shadow,
          shadowOpacity: 1,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 3 },
          elevation: 1,
        },
        Platform.OS === "web" && hovered && {
          borderColor: c.accent,
          transform: [{ scale: 1.01 }],
        },
        Platform.OS === "web" && {
          transition: "all 0.15s ease" as any,
          cursor: "default" as any,
        },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: isDesktop ? 16 : 15,
              fontWeight: "800",
              color: c.text,
            }}
          >
            {req.leaveType?.name || req.leaveTypeCode}
          </Text>
          <Text
            style={{
              fontSize: isDesktop ? 13 : 12,
              marginTop: 3,
              color: c.textMuted,
            }}
          >
            {req.fromDate}
            {req.fromDate !== req.toDate && ` → ${req.toDate}`}
            {req.halfDay && " · half day"}
            {`  ·  ${req.totalDays}d`}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: tone.bg,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
          }}
        >
          <Text style={{ color: tone.fg, fontSize: 10, fontWeight: "800" }}>
            {req.status}
          </Text>
        </View>
      </View>
      {!!req.reason && (
        <Text
          style={{
            fontSize: isDesktop ? 13 : 12,
            marginTop: 8,
            lineHeight: 17,
            color: c.textMuted,
          }}
        >
          {req.reason}
        </Text>
      )}
      {req.note ? (
        <Text
          style={{
            fontSize: isDesktop ? 13 : 12,
            marginTop: 6,
            fontStyle: "italic",
            color: c.text,
          }}
        >
          HR note: {req.note}
        </Text>
      ) : null}
      {req.status === "PENDING" && (
        <TouchableOpacity
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginTop: 10,
          }}
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
              fontWeight: "700",
            }}
          >
            Cancel request
          </Text>
        </TouchableOpacity>
      )}
    </Pressable>
  );
};

const makeStyles = (c: any, isDesktop: boolean) =>
  StyleSheet.create({
    safe: { flex: 1 },
    loader: { flex: 1, alignItems: "center", justifyContent: "center" },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: isDesktop ? 24 : 18,
      gap: 8,
    },
    iconBtn: {
      width: 42,
      height: 42,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { fontSize: isDesktop ? 28 : 26, fontWeight: "800" },
    subtitle: { fontSize: isDesktop ? 14 : 13, marginTop: 2 },
    applyBtn: {
      width: 46,
      height: 46,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      shadowOpacity: 0.2,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },

    section: {
      fontSize: isDesktop ? 12 : 11,
      fontWeight: "800",
      letterSpacing: 1.4,
      marginTop: isDesktop ? 24 : 18,
      marginBottom: isDesktop ? 14 : 10,
      marginLeft: 4,
    },

    // Desktop: 4 cards per row, Mobile: 2 cards per row
    balanceGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: isDesktop ? 16 : 10,
    },
    balanceCard: {
      width: isDesktop ? "23%" : "47%",
      flexGrow: 1,
      minWidth: isDesktop ? 200 : undefined,
      padding: isDesktop ? 18 : 14,
      borderRadius: 18,
      borderWidth: 1,
      shadowOpacity: 1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
      ...(Platform.OS === "web" && {
        transition: "all 0.15s ease" as any,
      }),
    },
    balanceIcon: {
      width: isDesktop ? 36 : 32,
      height: isDesktop ? 36 : 32,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: isDesktop ? 12 : 10,
    },
    balanceName: { fontSize: isDesktop ? 14 : 13, fontWeight: "700", marginBottom: 6 },
    balanceValue: { fontSize: isDesktop ? 36 : 30, fontWeight: "800" },
    balanceSub: { fontSize: isDesktop ? 13 : 12, marginTop: 2 },
    balanceFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: isDesktop ? 14 : 12,
    },
    balanceFoot: { fontSize: isDesktop ? 12 : 11, fontWeight: "700" },

    emptyCard: {
      padding: isDesktop ? 32 : 24,
      borderRadius: 18,
      borderWidth: 1,
      alignItems: "center",
      gap: 8,
      shadowOpacity: 1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    emptyText: { fontSize: isDesktop ? 15 : 14, fontWeight: "700", textAlign: "center" },
    emptySub: { fontSize: isDesktop ? 13 : 12, textAlign: "center" },

    // Form styles
    label: {
      fontSize: isDesktop ? 12 : 11,
      fontWeight: "800",
      letterSpacing: 1.2,
      marginTop: isDesktop ? 16 : 14,
      marginBottom: 6,
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: isDesktop ? 16 : 14,
    },
    textArea: {
      minHeight: isDesktop ? 100 : 80,
      padding: isDesktop ? 14 : 12,
      borderRadius: 12,
      borderWidth: 1,
      fontSize: 14,
      ...(Platform.OS === "web" && {
        outlineStyle: "none" as any,
      }),
    },
    errorBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: isDesktop ? 12 : 10,
      borderRadius: 12,
      borderWidth: 1,
      marginTop: 12,
    },
  });
