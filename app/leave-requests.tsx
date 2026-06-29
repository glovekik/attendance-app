import React, { useEffect, useState, useMemo } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
  Pressable,
  DimensionValue,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  hrListLeaveRequests,
  hrDecideLeaveRequest,
} from "../src/services/leaves";

import { LeaveRequest } from "../src/types";

import { useTheme } from "../src/theme/ThemeProvider";
import { useResponsive, getResponsiveSpacing } from "../src/utils/responsive";
import { PageHeader } from "../src/components/PageHeader";
import { WebModal, ModalActions } from "../src/components/WebModal";
import { ProButton, Avatar } from "../src/components/ProUI";
import { FormField, WebTextArea } from "../src/components/WebFormFields";
const BOTTOM_BAR_RESERVED_HEIGHT = 70;

export default function LeaveRequests() {

  const router = useRouter();

  const { theme } = useTheme();

  const c = theme.colors;

  const responsive = useResponsive();
  const spacing = getResponsiveSpacing(responsive.breakpoint);
  const isDesktop = responsive.isDesktop;
  const bottomPadding = responsive.showSidebar ? 40 : BOTTOM_BAR_RESERVED_HEIGHT + 24;

  const styles = useMemo(() => makeStyles(c, isDesktop), [c, isDesktop]);

  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectTarget, setRejectTarget] =
    useState<LeaveRequest | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const [popup, setPopup] = useState({
    visible: false,
    type: "success" as "success" | "error",
    message: "" });

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
      const res = await hrListLeaveRequests(token, "PENDING");
      setItems(res || []);
    } catch (err: any) {
      showPopup(err?.message || "Failed to load", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const confirmApprove = (
    r: LeaveRequest
  ): Promise<boolean> => {
    if (Platform.OS === "web") {
      return Promise.resolve(
        typeof window !== "undefined" &&
          window.confirm(
            `Approve ${r.user?.name || "user"}'s ${
              r.leaveType?.name || r.leaveTypeCode
            } from ${r.fromDate} to ${r.toDate}?`
          )
      );
    }
    return new Promise((resolve) => {
      Alert.alert(
        "Approve leave?",
        `${r.user?.name || "User"} · ${r.leaveType?.name || r.leaveTypeCode} · ${r.totalDays}d`,
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          { text: "Approve", onPress: () => resolve(true) },
        ]
      );
    });
  };

  const doApprove = async (r: LeaveRequest) => {
    if (busyId) return;
    const ok = await confirmApprove(r);
    if (!ok) return;
    try {
      setBusyId(r.id);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrDecideLeaveRequest(token, r.id, {
        action: "APPROVE" });
      showPopup("Approved");
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed to approve", "error");
    } finally {
      setBusyId(null);
    }
  };

  const openReject = (r: LeaveRequest) => {
    setRejectTarget(r);
    setRejectNote("");
    setRejectVisible(true);
  };

  const submitReject = async () => {
    if (!rejectTarget || busyId) return;
    try {
      setBusyId(rejectTarget.id);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrDecideLeaveRequest(token, rejectTarget.id, {
        action: "REJECT",
        note: rejectNote.trim() || undefined });
      showPopup("Rejected");
      setRejectVisible(false);
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed to reject", "error");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={c.accent} />
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
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding, padding: spacing.padding }]}
      >

        {isDesktop ? (
          <PageHeader
            title="Leave Requests"
            subtitle={`${items.length} pending requests`}
            breadcrumbs={[
              { label: "Home", href: "/" },
              { label: "Leave Requests" },
            ]}
          />
        ) : (
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
            >
              <Ionicons name="chevron-back" size={22} color={c.text} />
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Leave Requests</Text>
              <Text style={styles.subtitle}>
                {items.length} pending
              </Text>
            </View>
          </View>
        )}

        {items.length === 0 && (
          <View style={styles.emptyBox}>
            <Ionicons
              name="checkmark-done-outline"
              size={48}
              color={c.textFaint}
            />
            <Text style={styles.emptyTitle}>All clear</Text>
            <Text style={styles.emptySub}>
              No pending leave requests.
            </Text>
          </View>
        )}

        <View style={styles.cardsGrid}>
          {items.map((r) => (
            <Pressable
              key={r.id}
              style={({ hovered, pressed }) => [
                styles.card,
                Platform.OS === "web" && hovered && styles.cardHover,
                Platform.OS === "web" && pressed && styles.cardPressed,
              ]}
            >
              <View style={styles.cardHead}>
                <Avatar name={r.user?.name || "U"} size={isDesktop ? 44 : 40} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>
                    {r.user?.name || "User"}
                  </Text>
                  <Text style={styles.cardEmail}>
                    {r.user?.email || ""}
                  </Text>
                </View>
                <View style={styles.daysChip}>
                  <Text style={styles.daysChipText}>
                    {r.totalDays}d
                  </Text>
                </View>
              </View>

              <View style={styles.timeBox}>
                <View style={styles.timeRow}>
                  <Text style={styles.timeLabel}>Type</Text>
                  <Text style={styles.timeValue}>
                    {r.leaveType?.name || r.leaveTypeCode}
                  </Text>
                </View>
                <View style={styles.timeRow}>
                  <Text style={styles.timeLabel}>Dates</Text>
                  <Text style={styles.timeValue}>
                    {r.fromDate}
                    {r.fromDate !== r.toDate && ` → ${r.toDate}`}
                  </Text>
                </View>
                {r.halfDay && (
                  <View style={styles.timeRow}>
                    <Text style={styles.timeLabel}>Half-day</Text>
                    <Text style={styles.timeValue}>
                      {r.halfDayPart === "FIRST"
                        ? "First half"
                        : "Second half"}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.reasonLabel}>Reason</Text>
              <Text style={styles.reasonText}>{r.reason}</Text>

              {r.attachmentUrl ? (
                <Text style={styles.attachmentLink}>
                  Attachment: {r.attachmentUrl}
                </Text>
              ) : null}

              <View style={styles.actions}>
                <ProButton
                  label="Reject"
                  variant="danger"
                  icon="close-outline"
                  onPress={() => openReject(r)}
                  disabled={busyId === r.id}
                  style={{ flex: 1 }}
                />
                <ProButton
                  label="Approve"
                  variant="success"
                  icon="checkmark-outline"
                  onPress={() => doApprove(r)}
                  loading={busyId === r.id}
                  disabled={busyId === r.id}
                  style={{ flex: 1 }}
                />
              </View>

            </Pressable>
          ))}
        </View>

      </ScrollView>

      {/* REJECT MODAL */}
      <WebModal
        visible={rejectVisible}
        onClose={() => setRejectVisible(false)}
        title="Reject Leave Request"
        subtitle={rejectTarget ? `${rejectTarget.user?.name || "User"} · ${rejectTarget.leaveType?.name || rejectTarget.leaveTypeCode} · ${rejectTarget.totalDays}d` : undefined}
      >
        <FormField label="Reason (shown to user)">
          <WebTextArea
            value={rejectNote}
            onChangeText={setRejectNote}
            placeholder="Optional rejection reason..."
            rows={3}
          />
        </FormField>

        <ModalActions>
          <ProButton
            label="Cancel"
            variant="secondary"
            onPress={() => setRejectVisible(false)}
          />
          <ProButton
            label="Reject"
            variant="danger"
            icon="close-outline"
            onPress={submitReject}
            loading={!!busyId}
            disabled={!!busyId}
          />
        </ModalActions>
      </WebModal>

    </SafeAreaView>
  );
}

const makeStyles = (c: any, isDesktop: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
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
    backgroundColor: c.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: c.surfaceBorder,
  },
  title: { color: c.text, fontSize: 24, fontWeight: "800" },
  subtitle: { color: c.textMuted, fontSize: 13, marginTop: 3 },

  emptyBox: {
    alignItems: "center",
    padding: isDesktop ? 60 : 40,
    backgroundColor: c.surface,
    borderRadius: isDesktop ? 16 : 18,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    marginTop: 20,
    maxWidth: isDesktop ? 600 : undefined,
    alignSelf: isDesktop ? "center" : undefined,
    width: isDesktop ? "100%" as DimensionValue : undefined,
  },
  emptyTitle: {
    color: c.text,
    fontSize: isDesktop ? 20 : 17,
    fontWeight: "700",
    marginTop: 14,
  },
  emptySub: {
    color: c.textMuted,
    fontSize: isDesktop ? 14 : 13,
    marginTop: 6,
    textAlign: "center",
  },

  cardsGrid: {
    flexDirection: isDesktop ? "row" : "column",
    flexWrap: isDesktop ? "wrap" : "nowrap",
    gap: isDesktop ? 16 : 12,
    marginTop: isDesktop ? 8 : 0,
  },

  card: {
    backgroundColor: c.surface,
    borderRadius: isDesktop ? 12 : 16,
    padding: isDesktop ? 20 : 14,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    width: isDesktop ? "calc(50% - 8px)" as DimensionValue : "100%" as DimensionValue,
    ...(Platform.OS === "web" && isDesktop ? {
      transition: "all 0.15s ease",
      cursor: "default",
    } : {}),
  },
  cardHover: {
    backgroundColor: c.surfaceMuted,
    borderColor: c.accent,
  },
  cardPressed: {
    transform: [{ scale: 0.995 }],
  },

  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  cardName: {
    color: c.text,
    fontSize: isDesktop ? 16 : 15,
    fontWeight: "700",
  },
  cardEmail: {
    color: c.textMuted,
    fontSize: isDesktop ? 13 : 12,
    marginTop: 2,
  },
  daysChip: {
    backgroundColor: c.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  daysChipText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },

  timeBox: {
    backgroundColor: c.surfaceMuted,
    borderRadius: isDesktop ? 10 : 12,
    padding: 12,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    marginBottom: 12,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    gap: 12,
  },
  timeLabel: {
    color: c.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  timeValue: {
    color: c.text,
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "right",
  },

  reasonLabel: {
    color: c.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  reasonText: {
    color: c.text,
    fontSize: 14,
    lineHeight: 20,
  },
  attachmentLink: {
    color: "#60a5fa",
    fontSize: 12,
    marginTop: 8,
    ...(Platform.OS === "web" ? { cursor: "pointer" } : {}),
  },

  actions: {
    flexDirection: "row",
    gap: isDesktop ? 12 : 10,
    marginTop: isDesktop ? 16 : 14,
  },
});

