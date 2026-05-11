import React, { useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  Alert,
  Platform,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  attendanceReport,
  leaveReport,
  payrollReport,
  departmentsReport,
  attritionReport,
  downloadAttendanceXlsx,
  downloadLeaveRequestsXlsx,
  downloadPayrollXlsx,
  downloadUsersXlsx,
  DownloadResult,
} from "../src/services/reports";

type ReportKey =
  | "attendance"
  | "leave"
  | "payroll"
  | "departments"
  | "attrition";

const todayYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
};

const firstOfMonthYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-01`;
};

// Cross-platform XLSX save. On web, trigger an anchor download. On
// native, the best we can do without expo-file-system installed is alert
// the user with the file size + suggest using the web app.
const saveXlsx = async (result: DownloadResult) => {
  if (Platform.OS === "web") {
    // @ts-ignore — web-only
    const url = URL.createObjectURL(result.blob);
    // @ts-ignore — web-only
    const a = document.createElement("a");
    a.href = url;
    a.download = result.fileName;
    // @ts-ignore
    document.body.appendChild(a);
    a.click();
    // @ts-ignore
    document.body.removeChild(a);
    // @ts-ignore
    URL.revokeObjectURL(url);
    return;
  }
  Alert.alert(
    "XLSX downloaded",
    `${result.fileName} (${Math.round(result.blob.size / 1024)} KB). ` +
      "To save the file, open this in the web app — RN doesn't currently " +
      "have file-save support wired up."
  );
};

export default function HrReports() {
  const router = useRouter();
  const [activeReport, setActiveReport] = useState<ReportKey>(
    "attendance"
  );
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);

  // Filters
  const [fromDate, setFromDate] = useState(firstOfMonthYMD());
  const [toDate, setToDate] = useState(todayYMD());
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));

  const runReport = async () => {
    setLoading(true);
    setRows([]);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      let data: any[] = [];
      if (activeReport === "attendance") {
        data = await attendanceReport(token, fromDate, toDate);
      } else if (activeReport === "leave") {
        data = await leaveReport(token, parseInt(year, 10));
      } else if (activeReport === "payroll") {
        data = await payrollReport(
          token,
          parseInt(year, 10),
          parseInt(month, 10)
        );
      } else if (activeReport === "departments") {
        data = await departmentsReport(token);
      } else if (activeReport === "attrition") {
        data = await attritionReport(token, fromDate, toDate);
      }
      setRows(data || []);
    } catch (err: any) {
      Alert.alert("Report failed", err?.message || "");
    } finally {
      setLoading(false);
    }
  };

  const onDownload = async (which: string) => {
    setDownloading(which);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      let result: DownloadResult;
      if (which === "users") {
        result = await downloadUsersXlsx(token);
      } else if (which === "attendance") {
        result = await downloadAttendanceXlsx(token, fromDate, toDate);
      } else if (which === "leaves") {
        result = await downloadLeaveRequestsXlsx(token);
      } else if (which === "payroll") {
        result = await downloadPayrollXlsx(
          token,
          parseInt(year, 10),
          parseInt(month, 10)
        );
      } else {
        return;
      }
      await saveXlsx(result);
    } catch (err: any) {
      Alert.alert("Download failed", err?.message || "");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Reports</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          gap: 6,
        }}
      >
        {(
          [
            ["attendance", "Attendance"],
            ["leave", "Leave"],
            ["payroll", "Payroll"],
            ["departments", "Departments"],
            ["attrition", "Attrition"],
          ] as [ReportKey, string][]
        ).map(([k, label]) => (
          <TouchableOpacity
            key={k}
            style={[
              styles.tab,
              activeReport === k && styles.tabActive,
            ]}
            onPress={() => {
              setActiveReport(k);
              setRows([]);
            }}
          >
            <Text
              style={[
                styles.tabText,
                activeReport === k && styles.tabTextActive,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 12 }}>
        {/* Filters per report */}
        {(activeReport === "attendance" ||
          activeReport === "attrition") && (
          <View style={styles.filterRow}>
            <View style={styles.filterField}>
              <Text style={styles.label}>From</Text>
              <TextInput
                style={styles.input}
                value={fromDate}
                onChangeText={setFromDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#475569"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.filterField}>
              <Text style={styles.label}>To</Text>
              <TextInput
                style={styles.input}
                value={toDate}
                onChangeText={setToDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#475569"
                autoCapitalize="none"
              />
            </View>
          </View>
        )}
        {activeReport === "leave" && (
          <View style={styles.filterRow}>
            <View style={styles.filterField}>
              <Text style={styles.label}>Year</Text>
              <TextInput
                style={styles.input}
                value={year}
                onChangeText={setYear}
                keyboardType="number-pad"
                placeholderTextColor="#475569"
              />
            </View>
          </View>
        )}
        {activeReport === "payroll" && (
          <View style={styles.filterRow}>
            <View style={styles.filterField}>
              <Text style={styles.label}>Year</Text>
              <TextInput
                style={styles.input}
                value={year}
                onChangeText={setYear}
                keyboardType="number-pad"
                placeholderTextColor="#475569"
              />
            </View>
            <View style={styles.filterField}>
              <Text style={styles.label}>Month</Text>
              <TextInput
                style={styles.input}
                value={month}
                onChangeText={setMonth}
                keyboardType="number-pad"
                placeholderTextColor="#475569"
              />
            </View>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.runBtn]}
            onPress={runReport}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="play" size={14} color="#fff" />
            )}
            <Text style={styles.actionText}>
              {loading ? "Loading..." : "Run report"}
            </Text>
          </TouchableOpacity>

          {/* XLSX downloads — only some endpoints have XLSX */}
          {activeReport === "attendance" && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.xlsxBtn]}
              onPress={() => onDownload("attendance")}
              disabled={downloading === "attendance"}
            >
              <Ionicons name="download" size={14} color="#fff" />
              <Text style={styles.actionText}>
                {downloading === "attendance" ? "..." : "XLSX"}
              </Text>
            </TouchableOpacity>
          )}
          {activeReport === "payroll" && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.xlsxBtn]}
              onPress={() => onDownload("payroll")}
              disabled={downloading === "payroll"}
            >
              <Ionicons name="download" size={14} color="#fff" />
              <Text style={styles.actionText}>
                {downloading === "payroll" ? "..." : "XLSX"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Extra XLSX downloads always available */}
        <Text style={styles.sectionHeader}>OTHER EXPORTS</Text>
        <View style={styles.exportGrid}>
          <TouchableOpacity
            style={styles.exportTile}
            onPress={() => onDownload("users")}
            disabled={downloading === "users"}
          >
            <Ionicons
              name="people-outline"
              size={20}
              color="#0ea5e9"
            />
            <Text style={styles.exportText}>Users</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.exportTile}
            onPress={() => onDownload("leaves")}
            disabled={downloading === "leaves"}
          >
            <Ionicons
              name="airplane-outline"
              size={20}
              color="#0d9488"
            />
            <Text style={styles.exportText}>Leave Reqs</Text>
          </TouchableOpacity>
        </View>

        {/* RESULTS */}
        {rows.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>
              RESULTS ({rows.length})
            </Text>
            {rows.map((r, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.rowJson}>
                  {JSON.stringify(r, null, 2)}
                </Text>
              </View>
            ))}
          </>
        )}

        {rows.length === 0 && !loading && (
          <View style={{ alignItems: "center", marginTop: 30 }}>
            <Ionicons
              name="bar-chart-outline"
              size={42}
              color="#475569"
            />
            <Text style={styles.empty}>
              Pick filters and tap Run report
            </Text>
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b1220" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    gap: 12,
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "800", flex: 1 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  tabActive: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  tabText: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
  tabTextActive: { color: "#fff" },
  filterRow: { flexDirection: "row", gap: 8 },
  filterField: { flex: 1 },
  label: {
    color: "#94a3b8",
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#111827",
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  runBtn: { backgroundColor: "#16a34a", flex: 1 },
  xlsxBtn: { backgroundColor: "#3b82f6" },
  actionText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  sectionHeader: {
    color: "#64748b",
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "800",
    marginTop: 22,
    marginBottom: 8,
  },
  exportGrid: { flexDirection: "row", gap: 8 },
  exportTile: {
    flex: 1,
    backgroundColor: "#111827",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  exportText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  row: {
    backgroundColor: "#111827",
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  rowJson: {
    color: "#cbd5e1",
    fontSize: 11,
    fontFamily: "monospace",
  },
  empty: { color: "#475569", fontSize: 13, marginTop: 8 },
});
