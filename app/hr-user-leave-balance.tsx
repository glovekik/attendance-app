import React, { useCallback, useEffect, useState, useMemo} from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  hrListLeaveTypes,
  hrGetUserLeaveBalance,
  hrSetUserLeaveBalance } from "../src/services/leaves";
import { getUser } from "../src/services/users";
import { LeaveBalance, LeaveType, User } from "../src/types";
import { notify } from "../src/utils/confirm";

import { useTheme } from "../src/theme/ThemeProvider";
/**
 * HR per-user leave balance editor. Shows every active leave type with
 * the user's current allocated / used / pending values and lets HR edit
 * each one. Saves go through PUT /hr/users/{id}/leave-balance — the
 * backend uses `$set` so values are written exactly as entered.
 *
 * Used for one-off adjustments: carryover from previous year, manual
 * grants, or fixing miscounted balances. For org-wide top-ups (e.g.
 * "everyone gets +2 CL"), use the bulk allocate screen.
 */
export default function HrUserLeaveBalance() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [savingCode, setSavingCode] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [types, setTypes] = useState<LeaveType[]>([]);

  // Per-type form state — string so the input can be empty briefly.
  const [allocated, setAllocated] = useState<Record<string, string>>({});
  const [used, setUsed] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!id) {
      router.back();
      return;
    }
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const [u, t, b] = await Promise.all([
        getUser(token, id),
        hrListLeaveTypes(token),
        hrGetUserLeaveBalance(token, id),
      ]);
      setUser(u);
      const activeTypes = (t || []).filter((x) => x.isActive);
      setTypes(activeTypes);
      // Index balances by leaveTypeCode to seed the form inputs.
      const byCode: Record<string, LeaveBalance> = {};
      for (const row of b || []) {
        if (row.leaveTypeCode) byCode[row.leaveTypeCode] = row;
      }
      // Seed form inputs.
      const a: Record<string, string> = {};
      const u2: Record<string, string> = {};
      const p: Record<string, string> = {};
      for (const lt of activeTypes) {
        const row = byCode[lt.code];
        a[lt.code] = String(row?.allocated ?? lt.daysPerYear ?? 0);
        u2[lt.code] = String(row?.used ?? 0);
        p[lt.code] = String(row?.pending ?? 0);
      }
      setAllocated(a);
      setUsed(u2);
      setPending(p);
    } catch (err: any) {
      Alert.alert(
        "Couldn't load balance",
        err?.message || "Pull down to retry."
      );
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (code: string) => {
    if (savingCode) return;
    const allocatedNum = parseFloat(allocated[code] || "0");
    const usedNum = parseFloat(used[code] || "0");
    const pendingNum = parseFloat(pending[code] || "0");
    if (!Number.isFinite(allocatedNum) || allocatedNum < 0) {
      Alert.alert("Allocated must be a number ≥ 0");
      return;
    }
    if (!Number.isFinite(usedNum) || usedNum < 0) {
      Alert.alert("Used must be a number ≥ 0");
      return;
    }
    if (!Number.isFinite(pendingNum) || pendingNum < 0) {
      Alert.alert("Pending must be a number ≥ 0");
      return;
    }
    try {
      setSavingCode(code);
      const token = await AsyncStorage.getItem("token");
      if (!token || !id) return;
      await hrSetUserLeaveBalance(token, id, {
        leaveTypeCode: code,
        allocated: allocatedNum,
        used: usedNum,
        pending: pendingNum });
      notify("Saved", `${code} balance updated.`);
      await load();
    } catch (err: any) {
      Alert.alert("Save failed", err?.message || "");
    } finally {
      setSavingCode(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.loader}>
        <Text style={{ color: c.text }}>User not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace("/users")
          }
        >
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Leave Balance</Text>
          <Text style={styles.subtitle}>
            {user.name}
            {user.employeeCode ? ` · ${user.employeeCode}` : ""}
          </Text>
        </View>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        {types.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons
              name="information-circle-outline"
              size={32}
              color={c.textFaint}
            />
            <Text style={styles.emptyTitle}>
              No active leave types
            </Text>
            <Text style={styles.emptySub}>
              Create some in HR Admin → Leave Types first.
            </Text>
          </View>
        ) : (
          types.map((lt) => {
            const remaining =
              (parseFloat(allocated[lt.code] || "0") || 0) -
              (parseFloat(used[lt.code] || "0") || 0) -
              (parseFloat(pending[lt.code] || "0") || 0);
            const isSaving = savingCode === lt.code;
            return (
              <View key={lt.code} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.code}>{lt.code}</Text>
                    <Text style={styles.name}>{lt.name}</Text>
                  </View>
                  <View style={styles.remainingPill}>
                    <Text style={styles.remainingValue}>
                      {Number.isFinite(remaining)
                        ? remaining.toFixed(1)
                        : "—"}
                    </Text>
                    <Text style={styles.remainingLabel}>remaining</Text>
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={styles.field}>
                    <Text style={styles.label}>Allocated</Text>
                    <TextInput
                      style={styles.input}
                      value={allocated[lt.code]}
                      onChangeText={(v) =>
                        setAllocated((prev) => ({ ...prev, [lt.code]: v }))
                      }
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={c.textFaint}
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Used</Text>
                    <TextInput
                      style={styles.input}
                      value={used[lt.code]}
                      onChangeText={(v) =>
                        setUsed((prev) => ({ ...prev, [lt.code]: v }))
                      }
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={c.textFaint}
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Pending</Text>
                    <TextInput
                      style={styles.input}
                      value={pending[lt.code]}
                      onChangeText={(v) =>
                        setPending((prev) => ({ ...prev, [lt.code]: v }))
                      }
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={c.textFaint}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    isSaving && { opacity: 0.6 },
                  ]}
                  onPress={() => save(lt.code)}
                  disabled={!!savingCode}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save {lt.code}</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}

        <Text style={styles.footnote}>
          Allocated = total quota for the year. Used = approved leaves
          taken. Pending = currently-awaiting-approval. Remaining is
          computed from the three.
        </Text>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  loader: {
    flex: 1,
    backgroundColor: c.bg,
    justifyContent: "center",
    alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceBorder,
    gap: 12 },
  title: { color: c.text, fontSize: 18, fontWeight: "800" },
  subtitle: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  content: { padding: 16, paddingBottom: 60 },

  card: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    marginBottom: 10 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 10 },
  code: {
    color: "#0ea5e9",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1 },
  name: { color: c.text, fontSize: 15, fontWeight: "700", marginTop: 2 },
  remainingPill: {
    backgroundColor: c.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  remainingValue: { color: c.text, fontSize: 18, fontWeight: "800" },
  remainingLabel: {
    color: c.textMuted,
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 0.5 },

  row: { flexDirection: "row", gap: 8 },
  field: { flex: 1 },
  label: {
    color: c.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 4 },
  input: {
    backgroundColor: c.surfaceMuted,
    color: c.text,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    fontSize: 14 },

  saveBtn: {
    marginTop: 12,
    backgroundColor: "#16a34a",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },

  emptyBox: {
    alignItems: "center",
    padding: 30,
    backgroundColor: c.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    gap: 8 },
  emptyTitle: { color: c.text, fontSize: 15, fontWeight: "700" },
  emptySub: {
    color: c.textMuted,
    fontSize: 12,
    textAlign: "center" },

  footnote: {
    color: c.textMuted,
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 14,
    textAlign: "center",
    paddingHorizontal: 20 } });

