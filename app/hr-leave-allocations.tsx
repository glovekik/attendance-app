import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  hrListLeaveTypes,
  hrSetUserLeaveBalance } from "../src/services/leaves";
import { listUsers } from "../src/services/users";
import { LeaveType, User } from "../src/types";
import { confirmAction, notify } from "../src/utils/confirm";

import { useTheme } from "../src/theme/ThemeProvider";
/**
 * Bulk leave-balance allocation. HR picks a leave type, enters an
 * allocated value, ticks a list of employees (or hits Select All),
 * and the screen calls PUT /hr/users/{id}/leave-balance for each
 * selected user in sequence. Terminated users are excluded.
 *
 * Errors per-user are tolerated — failures bubble up in a summary
 * Alert so HR can retry the failures rather than the whole batch.
 */
export default function HrLeaveAllocations() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  const [users, setUsers] = useState<User[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Form state
  const [selectedType, setSelectedType] = useState<string>("");
  const [allocatedInput, setAllocatedInput] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const [u, t] = await Promise.all([
        listUsers(token),
        hrListLeaveTypes(token),
      ]);
      // Exclude terminated users — they can't log in and shouldn't
      // accrue new balance.
      setUsers((u || []).filter((x) => x.status !== "Terminated"));
      const activeTypes = (t || []).filter((x) => x.isActive);
      setTypes(activeTypes);
      if (activeTypes.length > 0 && !selectedType) {
        setSelectedType(activeTypes[0].code);
        setAllocatedInput(String(activeTypes[0].daysPerYear ?? 0));
      }
    } catch (err: any) {
      Alert.alert(
        "Couldn't load",
        err?.message || "Pull down to retry."
      );
    } finally {
      setLoading(false);
    }
  }, [router, selectedType]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.employeeCode || "").toLowerCase().includes(q)
      );
    });
  }, [users, search]);

  const allFilteredSelected =
    filteredUsers.length > 0 &&
    filteredUsers.every((u) => selectedIds.has(u.id));

  const toggleOne = (uid: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const toggleAll = () => {
    if (allFilteredSelected) {
      // Deselect only the currently-visible (filtered) subset so a
      // search doesn't wipe selections outside the filter.
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const u of filteredUsers) next.delete(u.id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const u of filteredUsers) next.add(u.id);
        return next;
      });
    }
  };

  const onApply = async () => {
    if (applying) return;
    if (!selectedType) {
      Alert.alert("Pick a leave type first");
      return;
    }
    const allocated = parseFloat(allocatedInput);
    if (!Number.isFinite(allocated) || allocated < 0) {
      Alert.alert("Allocated must be a number ≥ 0");
      return;
    }
    if (selectedIds.size === 0) {
      Alert.alert("Pick at least one employee");
      return;
    }

    const ok = await confirmAction({
      title: "Apply allocation?",
      message: `Set ${selectedType} = ${allocated} for ${selectedIds.size} employee${
        selectedIds.size > 1 ? "s" : ""
      }. This overwrites their current allocated value.`,
      confirmLabel: "Apply" });
    if (!ok) return;

    try {
      setApplying(true);
      const ids = Array.from(selectedIds);
      setProgress({ done: 0, total: ids.length });
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      const failures: { id: string; reason: string }[] = [];
      for (let i = 0; i < ids.length; i++) {
        const uid = ids[i];
        try {
          await hrSetUserLeaveBalance(token, uid, {
            leaveTypeCode: selectedType,
            allocated });
        } catch (err: any) {
          failures.push({ id: uid, reason: err?.message || "failed" });
        }
        setProgress({ done: i + 1, total: ids.length });
      }

      if (failures.length === 0) {
        notify(
          "Allocation applied",
          `${ids.length} employee${
            ids.length > 1 ? "s" : ""
          } updated.`
        );
        setSelectedIds(new Set());
      } else {
        const sample = failures.slice(0, 3).map((f) => f.reason).join("; ");
        Alert.alert(
          "Partial success",
          `${ids.length - failures.length} succeeded, ${
            failures.length
          } failed. First errors: ${sample}`
        );
      }
    } finally {
      setApplying(false);
      setProgress({ done: 0, total: 0 });
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
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/hr-admin")
          }
        >
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Bulk Allocate Leave</Text>
          <Text style={styles.subtitle}>
            Set the same allocated value for many employees at once
          </Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.label}>Leave Type</Text>
        {types.length === 0 ? (
          <Text style={styles.hint}>
            No active leave types. Create some in HR Admin → Leave
            Types.
          </Text>
        ) : (
          <View style={styles.chipRow}>
            {types.map((t) => (
              <TouchableOpacity
                key={t.code}
                style={[
                  styles.chip,
                  selectedType === t.code && styles.chipActive,
                ]}
                onPress={() => {
                  setSelectedType(t.code);
                  setAllocatedInput(String(t.daysPerYear ?? 0));
                }}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedType === t.code && styles.chipTextActive,
                  ]}
                >
                  {t.code} · {t.daysPerYear ?? 0}/yr
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>Allocated (days)</Text>
        <TextInput
          style={styles.input}
          value={allocatedInput}
          onChangeText={setAllocatedInput}
          keyboardType="decimal-pad"
          placeholder="12"
          placeholderTextColor={c.textFaint}
        />
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={c.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search employees by name, email, or code"
            placeholderTextColor={c.textFaint}
            autoCapitalize="none"
          />
        </View>
        <TouchableOpacity
          style={[
            styles.selectAllBtn,
            allFilteredSelected && styles.selectAllActive,
          ]}
          onPress={toggleAll}
        >
          <Ionicons
            name={allFilteredSelected ? "checkbox" : "square-outline"}
            size={18}
            color={allFilteredSelected ? "#fff" : "#94a3b8"}
          />
          <Text
            style={[
              styles.selectAllText,
              allFilteredSelected && { color: "#fff" },
            ]}
          >
            {allFilteredSelected ? "Unselect all" : "Select all"}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.counter}>
        {selectedIds.size} of {filteredUsers.length} selected
        {search ? " (filtered)" : ""}
      </Text>

      <FlatList
        data={filteredUsers}
        keyExtractor={(u) => u.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 120 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={36} color={c.textFaint} />
            <Text style={styles.emptyText}>No matching employees</Text>
          </View>
        }
        renderItem={({ item }) => {
          const picked = selectedIds.has(item.id);
          return (
            <TouchableOpacity
              style={[styles.row, picked && styles.rowPicked]}
              onPress={() => toggleOne(item.id)}
            >
              <Ionicons
                name={picked ? "checkbox" : "square-outline"}
                size={22}
                color={picked ? "#16a34a" : "#64748b"}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowMeta}>
                  {item.email}
                  {item.employeeCode ? ` · ${item.employeeCode}` : ""}
                </Text>
              </View>
              {item.status && item.status !== "Active" && (
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      {/* APPLY BAR */}
      <View style={styles.applyBar}>
        {applying ? (
          <View style={{ alignItems: "center", flex: 1 }}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.progressText}>
              {progress.done} / {progress.total}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.applyBtn,
              selectedIds.size === 0 && { opacity: 0.6 },
            ]}
            onPress={onApply}
            disabled={selectedIds.size === 0}
          >
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.applyBtnText}>
              Apply to {selectedIds.size} employee
              {selectedIds.size === 1 ? "" : "s"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
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

  formCard: {
    margin: 12,
    padding: 12,
    backgroundColor: c.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    gap: 8 },
  label: {
    color: c.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 6 },
  input: {
    backgroundColor: c.surfaceMuted,
    color: c.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    fontSize: 14 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  chipActive: { backgroundColor: c.accent, borderColor: c.accent },
  chipText: { color: c.textMuted, fontSize: 11, fontWeight: "700" },
  chipTextActive: { color: c.text },
  hint: { color: c.textMuted, fontSize: 12, fontStyle: "italic" },

  searchRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    gap: 8,
    alignItems: "center" },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  searchInput: {
    flex: 1,
    color: c.text,
    paddingVertical: 8,
    fontSize: 13 },
  selectAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: c.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    gap: 6 },
  selectAllActive: {
    backgroundColor: "#16a34a",
    borderColor: "#16a34a" },
  selectAllText: { color: c.textMuted, fontSize: 11, fontWeight: "700" },
  counter: {
    color: "#06b6d4",
    fontSize: 11,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontWeight: "700" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: c.surface,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  rowPicked: {
    borderColor: "#16a34a",
    backgroundColor: "rgba(22,163,74,0.08)" },
  rowName: { color: c.text, fontSize: 14, fontWeight: "700" },
  rowMeta: { color: c.textMuted, fontSize: 11, marginTop: 2 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#f59e0b" },
  statusText: { color: c.text, fontSize: 9, fontWeight: "800" },

  empty: { alignItems: "center", gap: 10, padding: 30 },
  emptyText: { color: c.textMuted, fontSize: 13 },

  applyBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    paddingBottom: 24,
    backgroundColor: c.bg,
    borderTopWidth: 1,
    borderTopColor: c.surfaceBorder },
  applyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.accent,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8 },
  applyBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  progressText: { color: c.text, fontSize: 12, marginTop: 6 } });

