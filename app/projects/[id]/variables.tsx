/**
 * Project Variables — the reusable snippets a project manager keeps for the
 * team: the staging connection string, the boilerplate config, the curl
 * command everyone keeps asking for in chat.
 *
 * Two audiences on one screen. A member browses and copies; a manager also
 * creates, edits and decides who each file is for. `viewerCanManage` comes
 * from the server, so the controls a member never sees are also controls the
 * API refuses them.
 *
 * The editor is a plain monospace TextInput rather than a syntax-highlighting
 * component: this content is pasted in and copied out, and a highlighter that
 * mangles whitespace or swallows a character would be worse than no
 * highlighting at all.
 */
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
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { WebModal, ModalActions } from "../../../src/components/WebModal";
import { Avatar } from "../../../src/components/Avatar";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { confirmAction, notify, notifySuccess } from "../../../src/utils/confirm";
import { getProject, getProjectMembers } from "../../../src/services/projects";
import {
  listProjectVariables,
  getProjectVariable,
  createProjectVariable,
  updateProjectVariable,
  deleteProjectVariable,
  ProjectVariableSummary,
  ProjectVariable,
  VariableVisibility,
} from "../../../src/services/projectVariables";
import { Project, ProjectMemberUser } from "../../../src/types";

const VISIBILITY: { key: VariableVisibility; label: string; hint: string }[] = [
  { key: "team", label: "Whole team", hint: "Everyone on this project" },
  { key: "selected", label: "Selected people", hint: "Only who you choose" },
  { key: "managers", label: "Managers only", hint: "Project managers and HR" },
];

const visLabel = (v: VariableVisibility) =>
  VISIBILITY.find((x) => x.key === v)?.label || v;

const visIcon = (v: VariableVisibility) =>
  v === "team" ? "people-outline" : v === "selected" ? "person-outline" : "lock-closed-outline";

export default function ProjectVariables() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMemberUser[]>([]);
  const [items, setItems] = useState<ProjectVariableSummary[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Viewer
  const [open, setOpen] = useState<ProjectVariable | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Editor
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [content, setContent] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<VariableVisibility>("team");
  const [allowed, setAllowed] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const [p, list, m] = await Promise.all([
        getProject(token, id).catch(() => null),
        listProjectVariables(token, id),
        // Only needed to name people in the picker; a member never opens it.
        getProjectMembers(token, id).catch(() => ({ members: [] as any[] })),
      ]);
      setProject(p);
      setItems(list.variables || []);
      setCanManage(!!list.viewerCanManage);
      setMembers(
        (m.members || [])
          .map((x: any) => x.user)
          .filter(Boolean) as ProjectMemberUser[]
      );
      setLoadError(null);
    } catch (err: any) {
      setLoadError(
        err?.message || "Couldn't load this project's variables."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const openFile = async (v: ProjectVariableSummary) => {
    try {
      setOpening(v.id);
      const token = await AsyncStorage.getItem("token");
      if (!token || !id) return;
      setOpen(await getProjectVariable(token, id, v.id));
      setCopied(false);
    } catch (err: any) {
      notify("Couldn't open file", err?.message || "");
    } finally {
      setOpening(null);
    }
  };

  const copy = async () => {
    if (!open) return;
    try {
      const Clip = require("expo-clipboard");
      await Clip.setStringAsync(open.content);
      setCopied(true);
      // Reverts on its own — a permanently "Copied" button stops confirming
      // anything the second time you press it.
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify("Couldn't copy", "Select the text and copy it manually.");
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFileName("");
    setContent("");
    setDescription("");
    setVisibility("team");
    setAllowed([]);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = async (v: ProjectVariableSummary) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token || !id) return;
      const full = await getProjectVariable(token, id, v.id);
      setEditingId(full.id);
      setFileName(full.fileName || "");
      setContent(full.content || "");
      setDescription(full.description || "");
      setVisibility(full.visibility);
      setAllowed(full.allowedUserIds || []);
      setShowForm(true);
    } catch (err: any) {
      notify("Couldn't open file", err?.message || "");
    }
  };

  const onSave = async () => {
    if (!fileName.trim()) {
      notify("File name is required");
      return;
    }
    if (visibility === "selected" && allowed.length === 0) {
      notify(
        "Choose who can see this",
        "Pick at least one person, or change the visibility."
      );
      return;
    }
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token || !id) return;
      const body = {
        fileName: fileName.trim(),
        content,
        description: description.trim() || null,
        visibility,
        allowedUserIds: visibility === "selected" ? allowed : [],
      };
      if (editingId) {
        await updateProjectVariable(token, id, editingId, body);
      } else {
        await createProjectVariable(token, id, body);
      }
      notifySuccess(editingId ? "Changes saved" : "File saved");
      setShowForm(false);
      resetForm();
      // If the open viewer is showing the file we just edited, refresh it.
      if (open && editingId === open.id) setOpen(null);
      load();
    } catch (err: any) {
      notify("Couldn't save", err?.message || "");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (v: ProjectVariableSummary) => {
    if (
      !(await confirmAction({
        title: "Delete this file?",
        message: `"${v.fileName}" will be removed for everyone on this project. This can't be undone.`,
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        destructive: true,
      }))
    )
      return;
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token || !id) return;
      await deleteProjectVariable(token, id, v.id);
      setItems((prev) => prev.filter((x) => x.id !== v.id));
      if (open?.id === v.id) setOpen(null);
      notifySuccess("File deleted");
    } catch (err: any) {
      notify("Couldn't delete", err?.message || "");
    }
  };

  const togglePerson = (uid: string) =>
    setAllowed((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]
    );

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
            router.canGoBack() ? router.back() : router.replace("/projects")
          }
        >
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Project Variables</Text>
          {!!project?.name && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {project.name}
            </Text>
          )}
        </View>
        {canManage && (
          <TouchableOpacity onPress={openCreate}>
            <Ionicons name="add-circle" size={28} color={c.accent} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={
          items.length === 0 ? styles.emptyWrap : { padding: 12 }
        }
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
        {loadError ? (
          <View style={styles.empty}>
            <Ionicons name="alert-circle-outline" size={42} color={c.textFaint} />
            <Text style={styles.emptyTitle}>Couldn't load</Text>
            <Text style={styles.emptySub}>{loadError}</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={load}>
              <Text style={styles.emptyBtnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="code-slash-outline" size={42} color={c.textFaint} />
            <Text style={styles.emptyTitle}>No variables yet</Text>
            <Text style={styles.emptySub}>
              {canManage
                ? "Save a snippet your team keeps asking for — a connection string, a config block, a curl command."
                : "Your project manager hasn't added any files yet."}
            </Text>
            {canManage && (
              <TouchableOpacity style={styles.emptyBtn} onPress={openCreate}>
                <Text style={styles.emptyBtnText}>Add the first one</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          items.map((v) => (
            <TouchableOpacity
              key={v.id}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => openFile(v)}
            >
              <View style={styles.cardIcon}>
                {opening === v.id ? (
                  <ActivityIndicator size="small" color={c.accent} />
                ) : (
                  <Ionicons name="document-text-outline" size={18} color={c.accent} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {v.fileName}
                </Text>
                {!!v.description && (
                  <Text style={styles.cardDesc} numberOfLines={1}>
                    {v.description}
                  </Text>
                )}
                <View style={styles.cardMetaRow}>
                  <Ionicons name={visIcon(v.visibility) as any} size={11} color={c.textFaint} />
                  <Text style={styles.cardMeta}>
                    {visLabel(v.visibility)} · {v.lineCount}{" "}
                    {v.lineCount === 1 ? "line" : "lines"}
                  </Text>
                </View>
              </View>
              {canManage && (
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => openEdit(v)} hitSlop={8} style={styles.iconBtn}>
                    <Ionicons name="create-outline" size={17} color={c.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => onDelete(v)} hitSlop={8} style={styles.iconBtn}>
                    <Ionicons name="trash-outline" size={17} color={c.textMuted} />
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* VIEWER */}
      <WebModal
        visible={!!open}
        onClose={() => setOpen(null)}
        title={open?.fileName || "File"}
        subtitle={open ? `${visLabel(open.visibility)} · ${open.lineCount} lines` : undefined}
        size="lg"
        footer={
          <ModalActions align="spread">
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={() => setOpen(null)}
            >
              <Text style={styles.btnGhostText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: copied ? "#16a34a" : c.accent }]}
              onPress={copy}
            >
              <Ionicons
                name={copied ? "checkmark" : "copy-outline"}
                size={16}
                color="#fff"
              />
              <Text style={styles.btnPrimaryText}>
                {copied ? "Copied" : "Copy"}
              </Text>
            </TouchableOpacity>
          </ModalActions>
        }
      >
        {!!open?.description && (
          <Text style={styles.viewerDesc}>{open.description}</Text>
        )}
        <ScrollView
          style={styles.codeWrap}
          horizontal={false}
          contentContainerStyle={{ padding: 12 }}
        >
          {/* Horizontal scroll on its own so a long line never widens the
              page — the body must not scroll sideways. */}
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <Text style={styles.code} selectable>
              {open?.content || ""}
            </Text>
          </ScrollView>
        </ScrollView>
      </WebModal>

      {/* CREATE / EDIT */}
      <WebModal
        visible={showForm}
        onClose={() => {
          setShowForm(false);
          resetForm();
        }}
        title={editingId ? "Edit file" : "New file"}
        size="lg"
        footer={
          <ModalActions align="spread">
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={() => {
                setShowForm(false);
                resetForm();
              }}
              disabled={saving}
            >
              <Text style={styles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: c.accent }, saving && { opacity: 0.6 }]}
              onPress={onSave}
              disabled={saving}
            >
              <Text style={styles.btnPrimaryText}>
                {saving ? "Saving…" : "Save"}
              </Text>
            </TouchableOpacity>
          </ModalActions>
        }
      >
        <Text style={styles.label}>
          File name <Text style={{ color: "#dc2626" }}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={fileName}
          onChangeText={setFileName}
          placeholder="e.g. staging.env"
          placeholderTextColor={c.textFaint}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          placeholder="What this is for"
          placeholderTextColor={c.textFaint}
        />

        <Text style={styles.label}>Code</Text>
        <TextInput
          style={[styles.input, styles.codeInput]}
          value={content}
          onChangeText={setContent}
          placeholder="Paste your snippet here"
          placeholderTextColor={c.textFaint}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
        />

        <Text style={styles.label}>Who can see this</Text>
        <View style={styles.visRow}>
          {VISIBILITY.map((v) => {
            const on = visibility === v.key;
            return (
              <TouchableOpacity
                key={v.key}
                style={[styles.visChip, on && styles.visChipOn]}
                onPress={() => setVisibility(v.key)}
              >
                <Ionicons
                  name={visIcon(v.key) as any}
                  size={13}
                  color={on ? c.accentText : c.textMuted}
                />
                <Text style={[styles.visText, on && styles.visTextOn]}>
                  {v.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.hint}>
          {VISIBILITY.find((v) => v.key === visibility)?.hint}
        </Text>

        {visibility === "selected" && (
          <View style={styles.pickWrap}>
            {members.length === 0 ? (
              <Text style={styles.hint}>
                No other members on this project yet.
              </Text>
            ) : (
              members.map((m) => {
                const on = allowed.includes(m.id);
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.pickRow, on && styles.pickRowOn]}
                    onPress={() => togglePerson(m.id)}
                  >
                    <Avatar name={m.name || ""} uri={m.profilePictureUrl} size={28} />
                    <Text style={styles.pickName} numberOfLines={1}>
                      {m.name}
                    </Text>
                    <Ionicons
                      name={on ? "checkmark-circle" : "ellipse-outline"}
                      size={19}
                      color={on ? c.accent : c.textFaint}
                    />
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}
      </WebModal>
    </SafeAreaView>
  );
}

const makeStyles = (c: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    loader: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.surfaceBorder,
    },
    title: { color: c.text, fontSize: 17, fontWeight: "800" },
    subtitle: { color: c.textMuted, fontSize: 12.5 },

    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    cardIcon: {
      width: 34,
      height: 34,
      borderRadius: 9,
      backgroundColor: c.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    cardName: { color: c.text, fontSize: 14.5, fontWeight: "700" },
    cardDesc: { color: c.textMuted, fontSize: 12, marginTop: 1 },
    cardMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
    cardMeta: { color: c.textFaint, fontSize: 11 },
    cardActions: { flexDirection: "row", gap: 2 },
    iconBtn: { padding: 5 },

    emptyWrap: { flexGrow: 1, justifyContent: "center" },
    empty: { alignItems: "center", gap: 10, padding: 30 },
    emptyTitle: { color: c.text, fontSize: 15, fontWeight: "700" },
    emptySub: {
      color: c.textMuted,
      fontSize: 13,
      textAlign: "center",
      maxWidth: 320,
      lineHeight: 19,
    },
    emptyBtn: {
      backgroundColor: c.accent,
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 10,
      marginTop: 4,
    },
    emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

    viewerDesc: { color: c.textMuted, fontSize: 13, marginBottom: 10 },
    codeWrap: {
      backgroundColor: c.surfaceMuted,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderRadius: 10,
      maxHeight: 420,
    },
    code: {
      color: c.text,
      fontSize: 12.5,
      lineHeight: 19,
      fontFamily: Platform.select({
        ios: "Menlo",
        android: "monospace",
        default: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      }),
    },

    label: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: "700",
      marginTop: 12,
      marginBottom: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: c.text,
      backgroundColor: c.surface,
    },
    codeInput: {
      minHeight: 180,
      textAlignVertical: "top",
      fontSize: 12.5,
      fontFamily: Platform.select({
        ios: "Menlo",
        android: "monospace",
        default: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      }),
    },

    visRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    visChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: c.surfaceMuted,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
    },
    visChipOn: { backgroundColor: c.accentSoft, borderColor: c.accent },
    visText: { color: c.textMuted, fontSize: 12, fontWeight: "700" },
    visTextOn: { color: c.accentText },
    hint: { color: c.textFaint, fontSize: 11.5, marginTop: 6 },

    pickWrap: { marginTop: 10, gap: 6 },
    pickRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      backgroundColor: c.surface,
    },
    pickRowOn: { borderColor: c.accent, backgroundColor: c.accentSoft },
    pickName: { flex: 1, color: c.text, fontSize: 13.5, fontWeight: "600" },

    btn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
    },
    btnGhost: { backgroundColor: c.surfaceMuted },
    btnGhostText: { color: c.text, fontWeight: "700", fontSize: 13 },
    btnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  });
