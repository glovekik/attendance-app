import React, { useMemo } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../src/theme/ThemeProvider";
interface TileProps {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  desc: string;
  onPress: () => void;
  styles: any;
  c: any;
}

const Tile = ({ icon, color, title, desc, onPress, styles, c }: TileProps) => (
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
    <Ionicons name="chevron-forward" size={22} color={c.textMuted} />
  </TouchableOpacity>
);

export default function HrRecruitment() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
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
          styles={styles}
          c={c}
        />
        <Tile
          icon="people-outline"
          color={c.accent}
          title="Candidates"
          desc="Pipeline across all stages"
          onPress={() => router.push("/hr-candidates" as any)}
          styles={styles}
          c={c}
        />
        <Tile
          icon="chatbubbles-outline"
          color="#8b5cf6"
          title="Interviews"
          desc="Schedule rounds & collect feedback"
          onPress={() => router.push("/hr-interviews" as any)}
          styles={styles}
          c={c}
        />
        <Tile
          icon="document-text-outline"
          color="#ec4899"
          title="Offers"
          desc="Draft, send & track responses"
          onPress={() => router.push("/hr-offers" as any)}
          styles={styles}
          c={c}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceBorder,
    gap: 12 },
  title: { color: c.text, fontSize: 22, fontWeight: "800" },
  subtitle: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  content: { padding: 16 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    gap: 12 },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center" },
  cardTitle: { color: c.text, fontSize: 15, fontWeight: "700" },
  cardDesc: { color: c.textMuted, fontSize: 12, marginTop: 3 } });

