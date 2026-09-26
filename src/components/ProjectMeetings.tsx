import React, { useMemo, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeProvider";
import type { ProjectMeeting, MeetingPayload } from "../services/projectPlanning";

/**
 * Meeting notes for a project.
 *
 * Decisions and action items are their own fields rather than paragraphs in
 * the body, because they are what people come back for. A decision buried
 * three weeks deep in prose may as well not have been written down.
 *
 * Anyone on the project can write a meeting up — whoever takes the minutes
 * is rarely the manager. Editing is narrower: the author or a manager, so
 * the record can be corrected but not quietly rewritten by anyone.
 */
export interface ProjectMeetingsProps {
  meetings: ProjectMeeting[];
  busy?: boolean;
  onCreate: (body: MeetingPayload) => void;
  onUpdate: (id: string, body: MeetingPayload) => void;
  onDelete: (m: ProjectMeeting) => void;
}

const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const prettyDate = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
};

const emptyDraft = (): MeetingPayload => ({
  title: "", date: today(), notes: "", decisions: "",
  actionItems: "", externalAttendees: "",
});

export const ProjectMeetings = ({
  meetings,
  busy,
  onCreate,
  onUpdate,
  onDelete,
}: ProjectMeetingsProps) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  const [composing, setComposing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MeetingPayload>(emptyDraft());
  const [expanded, setExpanded] = useState<string | null>(null);

  const startNew = () => {
    setDraft(emptyDraft());
    setEditingId(null);
    setComposing(true);
  };

  const startEdit = (m: ProjectMeeting) => {
    setDraft({
      title: m.title, date: m.date, time: m.time ?? undefined,
      notes: m.notes, decisions: m.decisions, actionItems: m.actionItems,
      externalAttendees: m.externalAttendees,
    });
    setEditingId(m.id);
    setComposing(true);
  };

  const submit = () => {
    if (!draft.title?.trim()) return;
    if (editingId) onUpdate(editingId, draft);
    else onCreate(draft);
    setComposing(false);
    setEditingId(null);
    setDraft(emptyDraft());
  };

  const field = (
    label: string,
    key: keyof MeetingPayload,
    opts: { lines?: number; placeholder?: string } = {}
  ) => (
    <View style={{ gap: 5 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, !!opts.lines && { minHeight: opts.lines * 22 }]}
        value={(draft[key] as string) || ""}
        onChangeText={(v) => setDraft((d) => ({ ...d, [key]: v }))}
        placeholder={opts.placeholder}
        placeholderTextColor={c.textFaint}
        multiline={!!opts.lines}
        textAlignVertical={opts.lines ? "top" : "center"}
        accessibilityLabel={label}
      />
    </View>
  );

  return (
    <View style={styles.wrap}>
      {!composing && (
        <TouchableOpacity style={styles.newBtn} onPress={startNew}>
          <Ionicons name="add" size={17} color="#fff" />
          <Text style={styles.newBtnText}>Write up a meeting</Text>
        </TouchableOpacity>
      )}

      {composing && (
        <View style={styles.composer}>
          <Text style={styles.composerHead}>
            {editingId ? "Edit notes" : "New meeting"}
          </Text>
          {field("Title", "title", { placeholder: "Weekly site sync" })}
          <View style={styles.twoUp}>
            <View style={{ flex: 1 }}>{field("Date", "date")}</View>
            <View style={{ flex: 1 }}>
              {field("Time", "time", { placeholder: "optional" })}
            </View>
          </View>
          {field("Who was there", "externalAttendees", {
            placeholder: "Names, including anyone outside the company",
          })}
          {field("Notes", "notes", {
            lines: 5, placeholder: "What was discussed",
          })}
          {field("Decisions", "decisions", {
            lines: 3, placeholder: "What was agreed — kept separate so it's findable",
          })}
          {field("Action items", "actionItems", {
            lines: 3, placeholder: "Who owes what, and by when",
          })}

          <View style={styles.composerFoot}>
            <TouchableOpacity
              style={styles.ghost}
              onPress={() => {
                setComposing(false);
                setEditingId(null);
              }}
            >
              <Text style={styles.ghostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.save, !draft.title?.trim() && { opacity: 0.45 }]}
              disabled={!draft.title?.trim() || busy}
              onPress={submit}
            >
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveText}>
                  {editingId ? "Save changes" : "Save notes"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!meetings.length && !composing && (
        <View style={styles.empty}>
          <Ionicons name="document-text-outline" size={26} color={c.textFaint} />
          <Text style={styles.emptyTitle}>No meetings recorded</Text>
          <Text style={styles.emptyText}>
            Anyone on the project can write one up — you don't have to be the
            manager.
          </Text>
        </View>
      )}

      {meetings.map((m) => {
        const open = expanded === m.id;
        return (
          <View key={m.id} style={styles.card}>
            <TouchableOpacity
              style={styles.cardHead}
              onPress={() => setExpanded(open ? null : m.id)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{m.title}</Text>
                <Text style={styles.cardMeta}>
                  {prettyDate(m.date)}
                  {m.time ? ` · ${m.time}` : ""} · {m.createdByName || "Unknown"}
                </Text>
              </View>
              <Ionicons
                name={open ? "chevron-up" : "chevron-down"}
                size={17}
                color={c.textMuted}
              />
            </TouchableOpacity>

            {/* Decisions and actions show even when collapsed — they're the
                reason anyone opens an old meeting. */}
            {!!m.decisions && (
              <View style={[styles.callout, styles.decision]}>
                <Text style={styles.calloutLabel}>DECIDED</Text>
                <Text style={styles.calloutText}>{m.decisions}</Text>
              </View>
            )}
            {!!m.actionItems && (
              <View style={[styles.callout, styles.action]}>
                <Text style={[styles.calloutLabel, { color: "#1d4ed8" }]}>
                  ACTIONS
                </Text>
                <Text style={styles.calloutText}>{m.actionItems}</Text>
              </View>
            )}

            {open && (
              <>
                {!!m.externalAttendees && (
                  <Text style={styles.attendees}>
                    Present: {m.externalAttendees}
                  </Text>
                )}
                {!!m.notes && <Text style={styles.notes}>{m.notes}</Text>}
                {!m.notes && !m.decisions && !m.actionItems && (
                  <Text style={styles.attendees}>No notes were written.</Text>
                )}
                {m.viewerCanEdit && (
                  <View style={styles.cardFoot}>
                    <TouchableOpacity
                      style={styles.linkBtn}
                      onPress={() => startEdit(m)}
                    >
                      <Ionicons name="create-outline" size={14} color={c.accent} />
                      <Text style={styles.linkText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.linkBtn}
                      onPress={() => onDelete(m)}
                    >
                      <Ionicons name="trash-outline" size={14} color="#dc2626" />
                      <Text style={[styles.linkText, { color: "#dc2626" }]}>
                        Delete
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        );
      })}
    </View>
  );
};

const makeStyles = (c: any) =>
  StyleSheet.create({
    wrap: { gap: 12, marginTop: 14 },
    newBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      backgroundColor: c.accent,
      borderRadius: 11,
      paddingVertical: 12,
    },
    newBtnText: { color: "#fff", fontWeight: "800", fontSize: 13.5 },
    composer: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderRadius: 14,
      padding: 14,
      gap: 11,
    },
    composerHead: { fontSize: 14, fontWeight: "800", color: c.text },
    twoUp: { flexDirection: "row", gap: 10 },
    label: {
      fontSize: 10.5,
      fontWeight: "800",
      color: c.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    input: {
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: c.surfaceMuted,
      color: c.text,
      fontSize: 14,
      lineHeight: 20,
    },
    composerFoot: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 10,
      marginTop: 2,
    },
    ghost: { paddingVertical: 10, paddingHorizontal: 14 },
    ghostText: { color: c.textMuted, fontWeight: "700", fontSize: 13 },
    save: {
      backgroundColor: c.accent,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 18,
    },
    saveText: { color: "#fff", fontWeight: "800", fontSize: 13 },
    empty: {
      alignItems: "center",
      gap: 6,
      paddingVertical: 28,
      paddingHorizontal: 22,
      borderRadius: 14,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: c.surfaceBorder,
    },
    emptyTitle: { fontSize: 14, fontWeight: "800", color: c.text },
    emptyText: {
      fontSize: 12.5,
      color: c.textMuted,
      textAlign: "center",
      lineHeight: 18,
    },
    card: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderRadius: 14,
      padding: 13,
      gap: 9,
    },
    cardHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    cardTitle: { fontSize: 14.5, fontWeight: "700", color: c.text },
    cardMeta: { fontSize: 11.5, color: c.textMuted, marginTop: 2 },
    callout: {
      borderRadius: 9,
      paddingHorizontal: 11,
      paddingVertical: 8,
      gap: 3,
    },
    decision: { backgroundColor: "rgba(22,163,74,0.10)" },
    action: { backgroundColor: "rgba(59,130,246,0.10)" },
    calloutLabel: {
      fontSize: 9.5,
      fontWeight: "800",
      letterSpacing: 0.5,
      color: "#15803d",
    },
    calloutText: { fontSize: 13, color: c.text, lineHeight: 19 },
    attendees: { fontSize: 12, color: c.textMuted, fontStyle: "italic" },
    notes: { fontSize: 13.5, color: c.text, lineHeight: 20 },
    cardFoot: {
      flexDirection: "row",
      gap: 18,
      paddingTop: 4,
      borderTopWidth: 1,
      borderTopColor: c.surfaceBorder,
      marginTop: 2,
    },
    linkBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingVertical: 8,
    },
    linkText: { fontSize: 12.5, fontWeight: "700", color: c.accent },
  });
