import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Linking,
  Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../src/theme/ThemeProvider";
import {
  listCompanyDocuments,
  CompanyDocument,
  COMPANY_DOC_CATEGORIES } from "../src/services/companyDocs";

export default function Policies() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  const [docs, setDocs] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const data = await listCompanyDocuments(token);
      setDocs(data || []);
    } catch (err: any) {
      Alert.alert(
        "Couldn't load policies",
        err?.message || "Pull down to retry."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((d) => {
      if (filter && d.category !== filter) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        (d.description || "").toLowerCase().includes(q) ||
        d.fileName.toLowerCase().includes(q)
      );
    });
  }, [docs, search, filter]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#0891b2" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Company Policies</Text>
          <Text style={styles.subtitle}>{filtered.length} documents</Text>
        </View>
      </View>

      <View style={styles.filterBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={c.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search policies, handbooks, forms"
            placeholderTextColor={c.textFaint}
            autoCapitalize="none"
          />
        </View>
        <View style={styles.chipRow}>
          <TouchableOpacity
            style={[styles.chip, !filter && styles.chipActive]}
            onPress={() => setFilter(null)}
          >
            <Text
              style={[
                styles.chipText,
                !filter && styles.chipTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          {COMPANY_DOC_CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, filter === c && styles.chipActive]}
              onPress={() => setFilter(filter === c ? null : c)}
            >
              <Text
                style={[
                  styles.chipText,
                  filter === c && styles.chipTextActive,
                ]}
              >
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(d) => d.id}
        contentContainerStyle={
          filtered.length === 0 ? styles.emptyWrap : { padding: 12 }
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor="#0891b2"
            colors={["#0891b2"]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-outline" size={42} color={c.textFaint} />
            <Text style={styles.emptyText}>
              No policies match your filter.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => Linking.openURL(item.fileUrl).catch(() => {})}
            activeOpacity={0.85}
          >
            <View style={styles.iconBox}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color="#fff"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{item.title}</Text>
              <Text style={styles.cardCat}>{item.category}</Text>
              {!!item.description && (
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              )}
              {!!item.effectiveFrom && (
                <Text style={styles.cardMeta}>
                  Effective {item.effectiveFrom}
                  {item.expiresOn ? ` → ${item.expiresOn}` : ""}
                </Text>
              )}
            </View>
            <Ionicons name="open-outline" size={18} color="#06b6d4" />
          </TouchableOpacity>
        )}
      />
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

  filterBar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceBorder },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  searchInput: { flex: 1, color: c.text, paddingVertical: 8, fontSize: 13 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  chipActive: { backgroundColor: "#0891b2", borderColor: "#0891b2" },
  chipText: { color: c.textMuted, fontSize: 11, fontWeight: "700" },
  chipTextActive: { color: c.text },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    gap: 12 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#0891b2",
    alignItems: "center",
    justifyContent: "center" },
  cardName: { color: c.text, fontSize: 14, fontWeight: "700" },
  cardCat: { color: "#06b6d4", fontSize: 11, fontWeight: "700", marginTop: 2 },
  cardDesc: { color: c.textMuted, fontSize: 12, marginTop: 4 },
  cardMeta: { color: c.textMuted, fontSize: 11, marginTop: 4 },

  emptyWrap: { flex: 1, justifyContent: "center" },
  empty: { alignItems: "center", gap: 10, padding: 30 },
  emptyText: {
    color: c.textMuted,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 30 } });

