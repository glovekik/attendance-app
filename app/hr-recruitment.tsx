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
  desc: string;
  onPress: () => void;
}

const Tile = ({ icon, color, title, desc, onPress }: TileProps) => (
  <TouchableOpacity
    style={styles.card}
    onPress={onPress}
    activeOpacity={0.85}
  >
    <View style={[styles.iconBox, { backgroundColor: color }]}>
      <Ionicons name={icon} size={22} color="#fff" />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDesc}>{desc}</Text>
    </View>
    <Ionicons name="chevron-forward" size={22} color="#64748b" />
  </TouchableOpacity>
);

export default function HrRecruitment() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Recruitment</Text>
          <Text style={styles.subtitle}>Pipeline · Interviews · Offers</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Tile
          icon="briefcase-outline"
          color="#0ea5e9"
          title="Job Openings"
          desc="Roles you're actively hiring for"
          onPress={() => router.push("/hr-job-openings" as any)}
        />
        <Tile
          icon="people-outline"
          color="#3b82f6"
          title="Candidates"
          desc="Pipeline across all stages"
          onPress={() => router.push("/hr-candidates" as any)}
        />
        <Tile
          icon="chatbubbles-outline"
          color="#8b5cf6"
          title="Interviews"
          desc="Schedule rounds & collect feedback"
          onPress={() => router.push("/hr-interviews" as any)}
        />
        <Tile
          icon="document-text-outline"
          color="#ec4899"
          title="Offers"
          desc="Draft, send & track responses"
          onPress={() => router.push("/hr-offers" as any)}
        />
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
  title: { color: "#fff", fontSize: 22, fontWeight: "800" },
  subtitle: { color: "#94a3b8", fontSize: 12, marginTop: 2 },
  content: { padding: 16 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
    gap: 12,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  cardDesc: { color: "#94a3b8", fontSize: 12, marginTop: 3 },
});
