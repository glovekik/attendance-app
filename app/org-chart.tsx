import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { getOrgChart, OrgChart, OrgPerson } from "../src/services/org";
import { Avatar } from "../src/components/Avatar";
import { UserProfileSheet } from "../src/components/UserProfileSheet";
import { PersonDetail, ProfileSeed } from "../src/components/PersonDetail";
import { useResponsive } from "../src/utils/responsive";
import { useTheme } from "../src/theme/ThemeProvider";

/** What the right-hand pane is currently showing. */
type Selection =
  | { kind: "all" }
  | { kind: "department"; id: string }
  | { kind: "project"; id: string }
  | { kind: "unassigned" };

/** A person plus the context that explains where they sit. */
interface Listed extends OrgPerson {
  contextLine: string;
  isManager?: boolean;
}

const sameSelection = (a: Selection, b: Selection) =>
  a.kind === b.kind && (a as any).id === (b as any).id;

export default function OrgBrowser() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const { isDesktop } = useResponsive();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [data, setData] = useState<OrgChart | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<Selection>({ kind: "all" });
  const [openDepts, setOpenDepts] = useState<Record<string, boolean>>({});
  // Mobile only: null = the top-level picker.
  const [drill, setDrill] = useState<Selection | null>(null);
  const [profile, setProfile] = useState<ProfileSeed | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      setData(await getOrgChart(token));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const deptName = useCallback(
    (id?: string | null) =>
      data?.departments.find((d) => d.id === id)?.name || "No department",
    [data]
  );

  /** Everyone once, annotated with their department and projects. */
  const allPeople: Listed[] = useMemo(() => {
    if (!data) return [];
    const projectsOf: Record<string, string[]> = {};
    const collect = (list: OrgChart["projectsWithoutDepartment"]) =>
      list.forEach((pr) =>
        [...pr.managers, ...pr.members].forEach((p) => {
          (projectsOf[p.id] ||= []).push(pr.name || "Project");
        })
      );
    data.departments.forEach((d) => collect(d.projects));
    collect(data.projectsWithoutDepartment);

    const seen = new Map<string, Listed>();
    const add = (p: OrgPerson) => {
      if (seen.has(p.id)) return;
      const projects = projectsOf[p.id] || [];
      seen.set(p.id, {
        ...p,
        contextLine: [
          deptName(p.departmentId),
          projects.length ? projects.join(", ") : null,
        ]
          .filter(Boolean)
          .join("  ·  "),
      });
    };
    if (data.ceo) add(data.ceo);
    data.departments.forEach((d) => {
      d.projects.forEach((pr) => [...pr.managers, ...pr.members].forEach(add));
      d.directMembers.forEach(add);
    });
    data.projectsWithoutDepartment.forEach((pr) =>
      [...pr.managers, ...pr.members].forEach(add)
    );
    data.unassigned.forEach(add);
    return [...seen.values()].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "")
    );
  }, [data, deptName]);

  /** People for a given selection, with the line that explains each one. */
  const paneFor = useCallback(
    (sel: Selection): { title: string; meta: string; people: Listed[] } => {
      if (!data) return { title: "", meta: "", people: [] };

      if (sel.kind === "all") {
        return {
          title: "Everyone",
          meta: `${allPeople.length} people`,
          people: allPeople,
        };
      }

      if (sel.kind === "unassigned") {
        return {
          title: "Unassigned",
          meta: `${data.unassigned.length} people · not in a department`,
          people: data.unassigned.map((p) => ({
            ...p,
            contextLine: p.jobTitle || "No department",
          })),
        };
      }

      if (sel.kind === "department") {
        const d = data.departments.find((x) => x.id === sel.id);
        if (!d) return { title: "", meta: "", people: [] };
        const seen = new Map<string, Listed>();
        d.projects.forEach((pr) => {
          pr.managers.forEach((p) =>
            seen.set(p.id, {
              ...p,
              isManager: true,
              contextLine: `${pr.name} · Project manager`,
            })
          );
          pr.members.forEach((p) => {
            if (!seen.has(p.id)) {
              seen.set(p.id, { ...p, contextLine: pr.name || "" });
            }
          });
        });
        d.directMembers.forEach((p) => {
          if (!seen.has(p.id)) {
            seen.set(p.id, {
              ...p,
              contextLine: p.jobTitle || "Not on a project",
            });
          }
        });
        return {
          title: d.name || "Department",
          meta: `${d.projects.length} projects · ${seen.size} people${
            d.head ? ` · Head: ${d.head.name}` : ""
          }`,
          people: [...seen.values()],
        };
      }

      const all = [
        ...data.departments.flatMap((d) => d.projects),
        ...data.projectsWithoutDepartment,
      ];
      const pr = all.find((x) => x.id === sel.id);
      if (!pr) return { title: "", meta: "", people: [] };
      return {
        title: pr.name || "Project",
        meta: `${deptName(pr.departmentId)} · ${pr.status} · ${pr.headcount} people`,
        people: [
          ...pr.managers.map((p) => ({
            ...p,
            isManager: true,
            contextLine: p.jobTitle || "Project manager",
          })),
          ...pr.members.map((p) => ({
            ...p,
            contextLine: p.jobTitle || "Member",
          })),
        ],
      };
    },
    [data, allPeople, deptName]
  );

  const pane = useMemo(
    () => paneFor(isDesktop ? selection : drill || { kind: "all" }),
    [paneFor, isDesktop, selection, drill]
  );

  const shownPeople = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pane.people;
    return pane.people.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.jobTitle || "").toLowerCase().includes(q) ||
        p.contextLine.toLowerCase().includes(q)
    );
  }, [pane.people, query]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loader}>
        <ActivityIndicator color={c.accent} />
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.loader}>
        <Text style={styles.emptySub}>Couldn&apos;t load the organization.</Text>
      </SafeAreaView>
    );
  }

  const picker = (onPick: (s: Selection) => void, activeSel?: Selection) => (
    <>
      <PickRow
        styles={styles}
        label="Everyone"
        count={allPeople.length}
        active={!!activeSel && sameSelection(activeSel, { kind: "all" })}
        onPress={() => onPick({ kind: "all" })}
      />

      {data.departments.map((d) => {
        const isOpen = !!openDepts[d.id];
        const activeIsThisDept =
          !!activeSel && sameSelection(activeSel, { kind: "department", id: d.id });
        return (
          <View key={d.id}>
            <PickRow
              styles={styles}
              label={d.name || "Department"}
              count={d.headcount}
              muted={d.headcount === 0 && d.projects.length === 0}
              active={
                !!activeSel &&
                sameSelection(activeSel, { kind: "department", id: d.id })
              }
              onPress={() => {
                onPick({ kind: "department", id: d.id });
                // Selecting a department reveals its projects; tapping the
                // selected one again folds them away.
                setOpenDepts((o) => ({
                  ...o,
                  [d.id]: !(isOpen && activeIsThisDept),
                }));
              }}
            />
            {isOpen &&
              d.projects.map((pr) => (
                <PickRow
                  key={pr.id}
                  styles={styles}
                  indent
                  label={pr.name || "Project"}
                  count={pr.headcount}
                  active={
                    !!activeSel &&
                    sameSelection(activeSel, { kind: "project", id: pr.id })
                  }
                  onPress={() => onPick({ kind: "project", id: pr.id })}
                />
              ))}
          </View>
        );
      })}

      {data.projectsWithoutDepartment.map((pr) => (
        <PickRow
          key={pr.id}
          styles={styles}
          label={pr.name || "Project"}
          count={pr.headcount}
          muted
          active={
            !!activeSel && sameSelection(activeSel, { kind: "project", id: pr.id })
          }
          onPress={() => onPick({ kind: "project", id: pr.id })}
        />
      ))}

      {data.unassigned.length > 0 && (
        <PickRow
          styles={styles}
          label="Unassigned"
          count={data.unassigned.length}
          muted
          active={!!activeSel && sameSelection(activeSel, { kind: "unassigned" })}
          onPress={() => onPick({ kind: "unassigned" })}
        />
      )}
    </>
  );

  const peopleList = (
    <>
      {shownPeople.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>
            {query ? "No one matches" : "No people here"}
          </Text>
          <Text style={styles.emptySub}>
            {query ? "Try a different name." : "Nothing to show yet."}
          </Text>
        </View>
      )}
      {shownPeople.map((p) => (
        <TouchableOpacity
          key={p.id}
          style={[
            styles.personCard,
            isDesktop && profile?.id === p.id && styles.personCardActive,
          ]}
          activeOpacity={0.85}
          onPress={() =>
            setProfile({
              id: p.id,
              name: p.name || undefined,
              profilePictureUrl: p.profilePictureUrl || undefined,
            })
          }
        >
          <Avatar
            name={p.name || "?"}
            uri={p.profilePictureUrl || undefined}
            size={36}
            bg={c.accent}
            fg="#fff"
            fontSize={13}
          />
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.personName} numberOfLines={1}>
                {p.name}
              </Text>
              {p.isManager && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>PM</Text>
                </View>
              )}
              {p.role === "CEO" && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>CEO</Text>
                </View>
              )}
            </View>
            <Text style={styles.personMeta} numberOfLines={1}>
              {p.contextLine || p.jobTitle || "—"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={c.textFaint} />
        </TouchableOpacity>
      ))}
    </>
  );

  const searchBox = (
    <View style={styles.searchBox}>
      <Ionicons name="search" size={16} color={c.textMuted} />
      <TextInput
        style={styles.searchInput}
        value={query}
        onChangeText={setQuery}
        placeholder="Search people"
        placeholderTextColor={c.textFaint}
      />
      {!!query && (
        <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
          <Ionicons name="close-circle" size={16} color={c.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );

  // ===== DESKTOP: pick on the left, people on the right =====
  if (isDesktop) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.split}>
          <View style={styles.leftPane}>
            <View style={styles.leftHeader}>
              <TouchableOpacity
                style={styles.backBtnSm}
                onPress={() =>
                  router.canGoBack() ? router.back() : router.replace("/")
                }
              >
                <Ionicons name="chevron-back" size={18} color={c.text} />
              </TouchableOpacity>
              <Text style={styles.leftTitle}>Organization</Text>
            </View>
            <ScrollView contentContainerStyle={{ padding: 12, gap: 2 }}>
              {picker(setSelection, selection)}
            </ScrollView>
          </View>

          <View style={styles.rightPane}>
            <View style={styles.rightHeader}>
              <Text style={styles.title}>{pane.title}</Text>
              <Text style={styles.subtitle}>{pane.meta}</Text>
              <View style={{ marginTop: 12 }}>{searchBox}</View>
            </View>
            <ScrollView
              contentContainerStyle={{ padding: 20, paddingTop: 14, gap: 10 }}
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
            >
              {peopleList}
            </ScrollView>
          </View>

          {/* Third pane: whoever is selected in the middle column. */}
          <View style={styles.detailPane}>
            {profile ? (
              <>
                <View style={styles.detailHeader}>
                  <Text style={styles.detailTitle}>Profile</Text>
                  <TouchableOpacity onPress={() => setProfile(null)} hitSlop={8}>
                    <Ionicons name="close" size={18} color={c.textMuted} />
                  </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={{ padding: 18 }}>
                  <PersonDetail person={profile} />
                </ScrollView>
              </>
            ) : (
              <View style={styles.detailEmpty}>
                <Ionicons
                  name="person-outline"
                  size={30}
                  color={c.textFaint}
                />
                <Text style={styles.emptySub}>
                  Select someone to see their details and projects.
                </Text>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ===== MOBILE: browse, then drill into one group =====
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
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
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              if (drill) {
                setDrill(null);
                setQuery("");
                return;
              }
              router.canGoBack() ? router.back() : router.replace("/");
            }}
          >
            <Ionicons name="chevron-back" size={22} color={c.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.titleMobile}>
              {drill ? pane.title : "Organization"}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {drill
                ? pane.meta
                : `${data.totals.people} people · ${data.totals.departments} departments · ${data.totals.projects} projects`}
            </Text>
          </View>
        </View>

        {drill ? (
          <>
            {searchBox}
            <View style={{ gap: 10, marginTop: 12 }}>{peopleList}</View>
          </>
        ) : (
          <View style={{ gap: 2 }}>{picker((s) => setDrill(s))}</View>
        )}
      </ScrollView>

      <UserProfileSheet person={profile} onClose={() => setProfile(null)} />
    </SafeAreaView>
  );
}

const PickRow = ({
  styles,
  label,
  count,
  active,
  muted,
  indent,
  onPress,
}: {
  styles: any;
  label: string;
  count?: number;
  active?: boolean;
  muted?: boolean;
  indent?: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    style={[styles.pickRow, indent && styles.pickIndent, active && styles.pickActive]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Text
      style={[
        styles.pickLabel,
        active && styles.pickLabelActive,
        muted && !active && styles.pickLabelMuted,
      ]}
      numberOfLines={1}
    >
      {label}
    </Text>
    {typeof count === "number" && (
      <Text style={[styles.pickCount, muted && !active && styles.pickCountMuted]}>
        {count}
      </Text>
    )}
  </TouchableOpacity>
);

const makeStyles = (c: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    container: { flex: 1 },
    content: { padding: 20, paddingBottom: 60 },
    loader: {
      flex: 1,
      backgroundColor: c.bg,
      justifyContent: "center",
      alignItems: "center",
    },

    split: { flex: 1, flexDirection: "row" },
    leftPane: {
      width: 252,
      borderRightWidth: 1,
      borderRightColor: c.surfaceBorder,
    },
    leftHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.surfaceBorder,
    },
    leftTitle: { color: c.text, fontSize: 15, fontWeight: "800" },
    rightPane: { flex: 1 },
    rightHeader: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: c.surfaceBorder,
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 18,
      marginTop: 10,
      gap: 12,
    },
    backBtnSm: {
      width: 32,
      height: 32,
      borderRadius: 9,
      backgroundColor: c.surface,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.surfaceBorder,
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
    title: { color: c.text, fontSize: 17, fontWeight: "800" },
    titleMobile: { color: c.text, fontSize: 22, fontWeight: "800" },
    subtitle: { color: c.textMuted, fontSize: 12, marginTop: 3 },

    pickRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 11,
      paddingVertical: 9,
      borderRadius: 8,
    },
    pickIndent: { paddingLeft: 26 },
    pickActive: { backgroundColor: c.surfaceMuted },
    pickLabel: { color: c.text, fontSize: 13, fontWeight: "600", flex: 1 },
    pickLabelActive: { color: c.accent },
    pickLabelMuted: { color: c.textFaint },
    pickCount: { color: c.textMuted, fontSize: 12, fontWeight: "700" },
    pickCountMuted: { color: c.textFaint },

    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      paddingHorizontal: 12,
      height: 40,
    },
    searchInput: {
      flex: 1,
      color: c.text,
      fontSize: 14,
      outlineStyle: "none",
    } as any,

    detailPane: {
      width: 330,
      borderLeftWidth: 1,
      borderLeftColor: c.surfaceBorder,
    },
    detailHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.surfaceBorder,
    },
    detailTitle: { color: c.text, fontSize: 15, fontWeight: "800" },
    detailEmpty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingHorizontal: 28,
    },
    personCardActive: { borderColor: c.accent },
    personCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      borderRadius: 10,
      paddingVertical: 9,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      gap: 10,
    },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    personName: { color: c.text, fontSize: 13.5, fontWeight: "700" },
    personMeta: { color: c.textMuted, fontSize: 11.5, marginTop: 2 },
    tag: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 5,
      backgroundColor: c.surfaceMuted,
    },
    tagText: { color: c.textMuted, fontSize: 10, fontWeight: "800" },

    emptyBox: {
      alignItems: "center",
      padding: 40,
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
    },
    emptyTitle: { color: c.text, fontSize: 16, fontWeight: "700" },
    emptySub: {
      color: c.textMuted,
      fontSize: 13,
      marginTop: 6,
      textAlign: "center",
    },
  });
