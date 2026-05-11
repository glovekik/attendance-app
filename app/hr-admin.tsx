import React from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

interface TileProps {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  onPress: () => void;
}

const Tile = ({ icon, color, title, onPress }: TileProps) => (
  <TouchableOpacity
    style={styles.mini}
    onPress={onPress}
    activeOpacity={0.85}
  >
    <View style={[styles.miniIcon, { backgroundColor: color }]}>
      <Ionicons name={icon} size={20} color="#fff" />
    </View>
    <Text style={styles.miniTitle} numberOfLines={1}>
      {title}
    </Text>
  </TouchableOpacity>
);

export default function HRAdmin() {

  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>HR Admin</Text>
            <Text style={styles.subtitle}>
              Everything HR-only, organised
            </Text>
          </View>
        </View>

        {/* PEOPLE */}
        <Text style={styles.section}>PEOPLE</Text>
        <View style={styles.grid}>
          <Tile
            icon="person-add-outline"
            color="#db2777"
            title="Users"
            onPress={() => router.push("/users")}
          />
          <Tile
            icon="business-outline"
            color="#0ea5e9"
            title="Departments"
            onPress={() => router.push("/hr-departments" as any)}
          />
          <Tile
            icon="folder-outline"
            color="#7c3aed"
            title="Projects"
            onPress={() => router.push("/hr-projects" as any)}
          />
          <Tile
            icon="rocket-outline"
            color="#06b6d4"
            title="Onboardings"
            onPress={() => router.push("/onboardings")}
          />
          <Tile
            icon="exit-outline"
            color="#64748b"
            title="Exits"
            onPress={() => router.push("/exits")}
          />
          <Tile
            icon="briefcase-outline"
            color="#ec4899"
            title="Recruitment"
            onPress={() => router.push("/hr-recruitment" as any)}
          />
        </View>

        {/* TIME OFF & APPROVALS */}
        <Text style={styles.section}>APPROVALS</Text>
        <View style={styles.grid}>
          <Tile
            icon="paper-plane-outline"
            color="#0d9488"
            title="Leaves"
            onPress={() => router.push("/leave-requests")}
          />
          <Tile
            icon="alert-circle-outline"
            color="#f59e0b"
            title="Corrections"
            onPress={() => router.push("/corrections")}
          />
          <Tile
            icon="card-outline"
            color="#3b82f6"
            title="Reimburse"
            onPress={() => router.push("/hr-reimbursements" as any)}
          />
          <Tile
            icon="time-outline"
            color="#6366f1"
            title="Timesheets"
            onPress={() => router.push("/hr-timesheets" as any)}
          />
          <Tile
            icon="options-outline"
            color="#0891b2"
            title="Leave Types"
            onPress={() => router.push("/leave-types")}
          />
        </View>

        {/* FINANCE */}
        <Text style={styles.section}>FINANCE</Text>
        <View style={styles.grid}>
          <Tile
            icon="cash-outline"
            color="#16a34a"
            title="Payroll"
            onPress={() => router.push("/payroll")}
          />
          <Tile
            icon="receipt-outline"
            color="#f59e0b"
            title="Office Expenses"
            onPress={() => router.push("/expenses")}
          />
        </View>

        {/* ASSETS */}
        <Text style={styles.section}>ASSETS</Text>
        <View style={styles.grid}>
          <Tile
            icon="cube-outline"
            color="#a855f7"
            title="Inventory"
            onPress={() => router.push("/hr-assets")}
          />
          <Tile
            icon="warning-outline"
            color="#c026d3"
            title="Reports"
            onPress={() => router.push("/asset-reports")}
          />
        </View>

        {/* INSIGHTS */}
        <Text style={styles.section}>INSIGHTS</Text>
        <View style={styles.grid}>
          <Tile
            icon="bar-chart-outline"
            color="#0ea5e9"
            title="Reports"
            onPress={() => router.push("/hr-reports" as any)}
          />
          <Tile
            icon="shield-checkmark-outline"
            color="#475569"
            title="Audit Logs"
            onPress={() => router.push("/hr-audit-logs" as any)}
          />
        </View>

        <View style={{ height: 30 }} />

      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({

  safe: {
    flex: 1,
    backgroundColor: "#0b1220",
  },

  container: {
    flex: 1,
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 10,
    gap: 12,
  },

  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1f2937",
  },

  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
  },

  subtitle: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: 3,
  },

  section: {
    color: "#64748b",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700",
    marginTop: 18,
    marginBottom: 10,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  mini: {
    width: "48%",
    backgroundColor: "#111827",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1f2937",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  miniIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  miniTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },

});
