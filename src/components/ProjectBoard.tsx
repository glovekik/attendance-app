import React, { useMemo, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { Avatar } from "./Avatar";
import { useTheme } from "../theme/ThemeProvider";
import type { Task, TaskStatus } from "../types";

/**
 * A task board that is actually a board.
 *
 * Three columns side by side, scrolled horizontally on a phone and fitted to
 * the width on a desktop. The first attempt at this stacked the three states
 * vertically, which is a list with headings — it loses the one thing a board
 * is for, which is seeing the shape of the work at a glance.
 *
 * Cards move by tapping, not dragging. Drag across react-native-web and
 * native, inside a scroll view, on both touch and mouse, is a reliable source
 * of bugs; a menu is faster on a phone and works with a keyboard.
 */
export type BoardTask = Task & {
  assignee?: { id: string; name?: string | null } | null;
};

export interface ProjectBoardProps {
  tasks: BoardTask[];
  /** Whole-project counts, which may exceed what's rendered when filtered. */
  counts: Record<TaskStatus, number>;
  canManage: boolean;
  onMove: (taskId: string, status: TaskStatus) => void;
  onOpen?: (taskId: string) => void;
  /** Quick-add straight into a column, so the board is a place you work. */
  onQuickAdd?: (status: TaskStatus) => void;
}

const COLUMNS: { key: TaskStatus; label: string; tone: string }[] = [
  { key: "PENDING", label: "To do", tone: "#94a3b8" },
  { key: "ONGOING", label: "In progress", tone: "#3b82f6" },
  { key: "COMPLETED", label: "Done", tone: "#16a34a" },
];

const PRIORITY_TONE: Record<string, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#ea580c",
  MEDIUM: "#d97706",
  LOW: "#64748b",
};

const fmtDue = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

/** Whole days until a due date, using calendar days so "today" is 0. */
const daysTo = (iso?: string | null): number | null => {
  if (!iso) return null;
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (isNaN(d.getTime())) return null;
  const end = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const n = new Date();
  const today = Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
  return Math.round((end - today) / 86_400_000);
};

export const ProjectBoard = ({
  tasks,
  counts,
  canManage,
  onMove,
  onOpen,
  onQuickAdd,
}: ProjectBoardProps) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const { width } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  // Three columns fit side by side from about 900px. Below that they scroll,
  // sized so the next column peeks in and the gesture is discoverable.
  const wide = width >= 900;
  const colWidth = wide ? undefined : Math.min(300, Math.max(240, width * 0.78));

  const body = (
    <View style={[styles.row, wide && styles.rowWide]}>
      {COLUMNS.map((col) => {
        const cards = tasks.filter((t) => t.status === col.key);
        return (
          <View
            key={col.key}
            style={[
              styles.col,
              wide ? styles.colWide : { width: colWidth },
            ]}
          >
            <View style={styles.colHead}>
              <View style={[styles.dot, { backgroundColor: col.tone }]} />
              <Text style={styles.colTitle}>{col.label}</Text>
              <View style={styles.countPill}>
                <Text style={styles.countText}>{counts[col.key] ?? 0}</Text>
              </View>
            </View>

            <View style={styles.colBody}>
              {!cards.length && (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>Nothing here</Text>
                </View>
              )}

              {cards.map((t) => {
                const left = daysTo(t.dueDate);
                const overdue =
                  left !== null && left < 0 && t.status !== "COMPLETED";
                const dueSoon =
                  left !== null && left >= 0 && left <= 2 &&
                  t.status !== "COMPLETED";
                const tone = PRIORITY_TONE[t.priority || "MEDIUM"];

                return (
                  <View key={t.id} style={styles.card}>
                    {/* Priority reads as a stripe rather than another chip —
                        it's an attribute of the card, not a second label. */}
                    <View style={[styles.stripe, { backgroundColor: tone }]} />

                    <TouchableOpacity
                      style={styles.cardBody}
                      activeOpacity={onOpen ? 0.7 : 1}
                      onPress={() => onOpen?.(t.id)}
                      disabled={!onOpen}
                    >
                      <View style={styles.cardTop}>
                        <Text style={styles.cardTitle} numberOfLines={3}>
                          {t.title}
                        </Text>
                        {typeof (t as any).weight === "number" && (
                          <View style={styles.weightChip}>
                            <Text style={styles.weightChipText}>
                              {(t as any).weight}%
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.cardFoot}>
                        {!!t.assignee?.name && (
                          <View style={styles.who}>
                            <Avatar name={t.assignee.name} size={18} />
                            <Text style={styles.whoText} numberOfLines={1}>
                              {t.assignee.name.split(" ")[0]}
                            </Text>
                          </View>
                        )}
                        {!!t.dueDate && (
                          <View
                            style={[
                              styles.due,
                              overdue && styles.dueBad,
                              dueSoon && styles.dueWarn,
                            ]}
                          >
                            <Ionicons
                              name="calendar-outline"
                              size={11}
                              color={
                                overdue
                                  ? "#dc2626"
                                  : dueSoon
                                  ? "#b45309"
                                  : c.textMuted
                              }
                            />
                            <Text
                              style={[
                                styles.dueText,
                                overdue && styles.dueTextBad,
                                dueSoon && styles.dueTextWarn,
                              ]}
                            >
                              {overdue
                                ? `${Math.abs(left!)}d late`
                                : fmtDue(t.dueDate)}
                            </Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>

                    {canManage && t.status !== "COMPLETED" && (
                      <TouchableOpacity
                        style={styles.advanceBtn}
                        onPress={() =>
                          onMove(
                            t.id,
                            t.status === "PENDING" ? "ONGOING" : "COMPLETED"
                          )
                        }
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={
                          t.status === "PENDING"
                            ? `Start ${t.title}`
                            : `Complete ${t.title}`
                        }
                      >
                        <Ionicons
                          name={
                            t.status === "PENDING"
                              ? "play-circle-outline"
                              : "checkmark-circle-outline"
                          }
                          size={19}
                          color={t.status === "PENDING" ? "#3b82f6" : "#16a34a"}
                        />
                      </TouchableOpacity>
                    )}

                    {canManage && (
                      <TouchableOpacity
                        style={styles.moveBtn}
                        onPress={() =>
                          setMenuFor(menuFor === t.id ? null : t.id)
                        }
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Move ${t.title}`}
                      >
                        <Ionicons
                          name="ellipsis-horizontal"
                          size={16}
                          color={c.textMuted}
                        />
                      </TouchableOpacity>
                    )}

                    {menuFor === t.id && (
                      <View style={styles.menu}>
                        <Text style={styles.menuHead}>Move to</Text>
                        {COLUMNS.filter((x) => x.key !== t.status).map((x) => (
                          <TouchableOpacity
                            key={x.key}
                            style={styles.menuItem}
                            onPress={() => {
                              setMenuFor(null);
                              onMove(t.id, x.key);
                            }}
                          >
                            <View
                              style={[styles.dot, { backgroundColor: x.tone }]}
                            />
                            <Text style={styles.menuText}>{x.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
              {canManage && !!onQuickAdd && (
                <TouchableOpacity
                  style={styles.quickAdd}
                  onPress={() => onQuickAdd(col.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Add a task to ${col.label}`}
                >
                  <Ionicons name="add" size={15} color={c.textMuted} />
                  <Text style={styles.quickAddText}>Add task</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );

  if (wide) return body;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroller}
    >
      {body}
    </ScrollView>
  );
};

const makeStyles = (c: any) =>
  StyleSheet.create({
    scroller: { paddingRight: 16 },
    row: { flexDirection: "row", gap: 12 },
    rowWide: { width: "100%" },
    col: {
      backgroundColor: c.surfaceMuted,
      borderRadius: 14,
      padding: 10,
    },
    colWide: { flex: 1 },
    colHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 4,
      paddingBottom: 10,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    colTitle: {
      flex: 1,
      fontSize: 12,
      fontWeight: "800",
      color: c.text,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    countPill: {
      minWidth: 22,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: c.surface,
      alignItems: "center",
    },
    countText: { fontSize: 11, fontWeight: "800", color: c.textMuted },
    colBody: { gap: 8 },
    empty: {
      paddingVertical: 22,
      alignItems: "center",
      borderRadius: 10,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: c.surfaceBorder,
    },
    emptyText: { fontSize: 12, color: c.textFaint },
    card: {
      flexDirection: "row",
      backgroundColor: c.surface,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      overflow: "visible",
      ...Platform.select({
        web: { boxShadow: "0 1px 2px rgba(16,16,24,0.06)" as any },
        default: {
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
        },
      }),
    },
    stripe: {
      width: 3,
      borderTopLeftRadius: 11,
      borderBottomLeftRadius: 11,
    },
    cardBody: { flex: 1, padding: 10, gap: 8 },
    cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
    weightChip: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: c.accentSoft,
    },
    weightChipText: { fontSize: 10, fontWeight: "800", color: c.accentText },
    advanceBtn: { paddingLeft: 6, paddingTop: 10 },
    quickAdd: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: c.surfaceBorder,
    },
    quickAddText: { fontSize: 12, fontWeight: "700", color: c.textMuted },
    cardTitle: {
      flex: 1,
      fontSize: 13.5,
      lineHeight: 19,
      fontWeight: "600",
      color: c.text,
    },
    cardFoot: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    who: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 },
    whoText: { fontSize: 11, color: c.textMuted, fontWeight: "600" },
    due: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: c.surfaceMuted,
    },
    dueWarn: { backgroundColor: "rgba(245,158,11,0.14)" },
    dueBad: { backgroundColor: "rgba(220,38,38,0.12)" },
    dueText: { fontSize: 10.5, fontWeight: "700", color: c.textMuted },
    dueTextWarn: { color: "#b45309" },
    dueTextBad: { color: "#dc2626" },
    moveBtn: { paddingHorizontal: 8, paddingTop: 10 },
    menu: {
      position: "absolute",
      right: 6,
      top: 34,
      zIndex: 20,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderRadius: 10,
      paddingVertical: 4,
      minWidth: 150,
      ...Platform.select({
        web: { boxShadow: "0 8px 24px rgba(16,16,24,0.16)" as any },
        default: {
          shadowColor: "#000",
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        },
      }),
    },
    menuHead: {
      fontSize: 10,
      fontWeight: "800",
      color: c.textFaint,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      paddingHorizontal: 12,
      paddingTop: 6,
      paddingBottom: 4,
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    menuText: { fontSize: 13, color: c.text, fontWeight: "600" },
  });
