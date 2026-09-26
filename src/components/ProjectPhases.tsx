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
import type { ProjectPhase, ProjectProgressInfo } from "../services/projectPlanning";

/**
 * Phases, and the control over what the project's headline percentage means.
 *
 * Each phase shows its own bar read off its tasks. Overall is the weighted
 * average, because phases are rarely equal — a two-week survey and a
 * three-month rollout should not each count for half.
 *
 * A manager can pin the number when the arithmetic can't see the truth, but
 * the derived figure stays on screen beside it. An override that hides what
 * the tasks say is how a dashboard starts lying.
 */
export interface ProjectPhasesProps {
  phases: ProjectPhase[];
  progress: ProjectProgressInfo;
  /** The project's 100% budget across phases. */
  budget: { allocated: number; remaining: number; balanced: boolean };
  canManage: boolean;
  busy?: boolean;
  onAdd: (name: string, weight: number) => void;
  onSetWeight: (phaseId: string, weight: number) => void;
  onDelete: (phase: ProjectPhase) => void;
  onSetTaskWeight: (taskId: string, weight: number) => void;
  /** Open the task form with this phase already chosen. */
  onAddTask: (phaseId: string) => void;
  onOverride: (percent: number | null) => void;
}

const SOURCE_LABEL: Record<ProjectProgressInfo["source"], string> = {
  tasks: "From completed tasks",
  phases: "Weighted average of phases",
  manual: "Set by a manager",
};

/**
 * A percentage you type, committed on blur or Enter.
 *
 * Weights are shares of a whole — the phases of a project add to 100, and
 * so do the tasks inside a phase — which is far easier to reason about than
 * the ×1 ×2 ×3 multipliers this replaced, where "×3" told you nothing
 * without seeing every other number.
 *
 * `remaining` is what's unallocated excluding this field's own value, so
 * the input can refuse a number that would push the total past 100 before
 * the server has to.
 */
const WeightField = ({
  value,
  editable,
  onCommit,
  remaining,
}: {
  value: number;
  editable: boolean;
  onCommit: (weight: number) => void;
  /** Unallocated budget, this field's own value excluded. */
  remaining?: number;
}) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);

  // Follow the server once we're not the one typing.
  React.useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  const commit = () => {
    setFocused(false);
    const n = Number(text);
    if (!isFinite(n) || n < 0) {
      setText(String(value));
      return;
    }
    let rounded = Math.round(n * 10) / 10;
    if (typeof remaining === "number" && rounded > remaining) {
      // Clamp rather than reject: the person clearly wants "as much as
      // possible", and bouncing them back to the old number to retype is
      // worse than giving them the largest value that fits.
      rounded = Math.round(remaining * 10) / 10;
      setText(String(rounded));
    }
    if (rounded !== value) onCommit(rounded);
  };

  if (!editable) {
    return (
      <View style={styles.weightStatic}>
        <Text style={styles.weightStaticText}>{value}%</Text>
      </View>
    );
  }

  return (
    <View style={styles.weightBox}>
      <TextInput
        style={styles.weightInput}
        value={text}
        onChangeText={(v) => setText(v.replace(/[^\d.]/g, ""))}
        onFocus={() => setFocused(true)}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType="decimal-pad"
        maxLength={4}
        returnKeyType="done"
        accessibilityLabel="Weight percent"
      />
      <Text style={styles.weightPct}>%</Text>
    </View>
  );
};

/** "82% of 100 · 18% left" — or a warning when it doesn't add up. */
const BudgetBar = ({
  allocated,
  balanced,
  label,
}: {
  allocated: number;
  balanced: boolean;
  label: string;
}) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  const over = allocated > 100.05;
  const remaining = Math.round((100 - allocated) * 10) / 10;
  return (
    <View style={styles.budget}>
      <View style={styles.budgetTrack}>
        <View
          style={[
            styles.budgetFill,
            {
              width: `${Math.min(100, allocated)}%`,
              backgroundColor: over
                ? "#dc2626"
                : balanced
                ? "#16a34a"
                : c.accent,
            },
          ]}
        />
      </View>
      <Text
        style={[
          styles.budgetText,
          over && { color: "#dc2626" },
          balanced && { color: "#15803d" },
        ]}
      >
        {over
          ? `${allocated}% allocated — ${Math.abs(remaining)}% over`
          : balanced
          ? `${label} add up to 100%`
          : `${allocated}% allocated · ${remaining}% left`}
      </Text>
    </View>
  );
};

export const ProjectPhases = ({
  phases,
  progress,
  budget,
  canManage,
  busy,
  onAdd,
  onSetWeight,
  onDelete,
  onSetTaskWeight,
  onAddTask,
  onOverride,
}: ProjectPhasesProps) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  const [name, setName] = useState("");
  const [weight, setWeight] = useState("");
  const [pinning, setPinning] = useState(false);
  const [pinValue, setPinValue] = useState(String(progress.percent));

  const manual = progress.source === "manual";

  return (
    <View style={styles.wrap}>
      {/* ---- what the percentage means, and who decides it ---- */}
      <View style={styles.headCard}>
        <View style={styles.headRow}>
          <Text style={styles.big}>{progress.percent}%</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.sourceLabel}>
              {SOURCE_LABEL[progress.source]}
            </Text>
            {manual && (
              <Text style={styles.derivedNote}>
                Tasks say {progress.derived}% ·{" "}
                {progress.taskCompleted}/{progress.taskTotal} done
              </Text>
            )}
            {!manual && (
              <Text style={styles.derivedNote}>
                {progress.taskCompleted}/{progress.taskTotal} tasks complete
              </Text>
            )}
          </View>
          {manual && (
            <View style={styles.manualPill}>
              <Ionicons name="hand-left-outline" size={11} color="#b45309" />
              <Text style={styles.manualText}>MANUAL</Text>
            </View>
          )}
        </View>

        <View style={styles.bigTrack}>
          <View
            style={[
              styles.bigFill,
              {
                width: `${progress.percent}%`,
                backgroundColor: manual ? "#d97706" : c.accent,
              },
            ]}
          />
          {/* Where the tasks actually are, when a manager has pinned
              something different. Two numbers, both visible. */}
          {manual && progress.derived !== progress.percent && (
            <View
              style={[styles.derivedMark, { left: `${progress.derived}%` }]}
            />
          )}
        </View>

        <BudgetBar
          allocated={budget.allocated}
          balanced={budget.balanced}
          label="Phases"
        />

        {canManage && (
          <View style={styles.pinRow}>
            {!pinning ? (
              <>
                <TouchableOpacity
                  style={styles.linkBtn}
                  onPress={() => {
                    setPinValue(String(progress.percent));
                    setPinning(true);
                  }}
                >
                  <Ionicons name="create-outline" size={14} color={c.accent} />
                  <Text style={styles.linkText}>
                    {manual ? "Change the pinned %" : "Set the % by hand"}
                  </Text>
                </TouchableOpacity>
                {manual && (
                  <TouchableOpacity
                    style={styles.linkBtn}
                    onPress={() => onOverride(null)}
                  >
                    <Ionicons name="refresh" size={14} color={c.textMuted} />
                    <Text style={[styles.linkText, { color: c.textMuted }]}>
                      Back to automatic
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={styles.pinEdit}>
                <TextInput
                  style={styles.pinInput}
                  value={pinValue}
                  onChangeText={(v) => setPinValue(v.replace(/[^\d]/g, ""))}
                  keyboardType="number-pad"
                  maxLength={3}
                  accessibilityLabel="Progress percent"
                />
                <Text style={styles.pinPct}>%</Text>
                <TouchableOpacity
                  style={styles.pinSave}
                  onPress={() => {
                    const n = Math.max(0, Math.min(100, Number(pinValue) || 0));
                    onOverride(n);
                    setPinning(false);
                  }}
                >
                  <Text style={styles.pinSaveText}>Set</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setPinning(false)}>
                  <Text style={styles.pinCancel}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      {/* ---- the phases themselves ---- */}
      {!phases.length && (
        <View style={styles.empty}>
          <Ionicons name="layers-outline" size={26} color={c.textFaint} />
          <Text style={styles.emptyTitle}>No phases yet</Text>
          <Text style={styles.emptyText}>
            Break the project into stages — Survey, Build, Handover — and
            assign tasks to each. Progress then reflects how far through the
            plan you are, not just how many tasks are ticked.
          </Text>
        </View>
      )}

      {phases.map((p, i) => (
        <View key={p.id} style={styles.phase}>
          <View style={styles.phaseHead}>
            <View style={styles.numBadge}>
              <Text style={styles.numText}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.phaseName}>{p.name}</Text>
              <Text style={styles.phaseMeta}>
                {p.completedCount}/{p.taskCount} tasks
                {p.taskCount === 0 ? " · nothing assigned yet" : ""}
              </Text>
            </View>
            <Text style={styles.phasePct}>{p.percent}%</Text>
            {canManage && (
              <TouchableOpacity
                onPress={() => onDelete(p)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${p.name}`}
              >
                <Ionicons name="trash-outline" size={16} color={c.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${p.percent}%`,
                  backgroundColor:
                    p.percent === 100 ? "#16a34a" : c.accent,
                },
              ]}
            />
          </View>

          {/* The phase's own tasks, each carrying the weight that decides
              how much of the bar above it accounts for. */}
          {!!p.tasks.length && (
            <View style={styles.taskList}>
              {p.tasks.map((t) => {
                const done = t.status === "COMPLETED";
                return (
                  <View key={t.id} style={styles.taskRow}>
                    <Ionicons
                      name={done ? "checkmark-circle" : "ellipse-outline"}
                      size={15}
                      color={done ? "#16a34a" : c.textFaint}
                    />
                    <Text
                      style={[styles.taskTitle, done && styles.taskDone]}
                      numberOfLines={1}
                    >
                      {t.title}
                    </Text>
                    <WeightField
                      value={t.weight}
                      editable={canManage}
                      remaining={p.taskWeightRemaining + t.weight}
                      onCommit={(w) => onSetTaskWeight(t.id, w)}
                    />
                  </View>
                );
              })}
              <BudgetBar
                allocated={p.taskWeightAllocated}
                balanced={p.taskWeightBalanced}
                label="Tasks"
              />
            </View>
          )}

          {canManage && (
            <TouchableOpacity
              style={styles.addTask}
              onPress={() => onAddTask(p.id)}
              accessibilityRole="button"
              accessibilityLabel={`Add a task to ${p.name}`}
            >
              <Ionicons name="add" size={15} color={c.accent} />
              <Text style={styles.addTaskText}>Add a task to this phase</Text>
            </TouchableOpacity>
          )}

          {canManage && (
            <View style={styles.weightRow}>
              <Text style={styles.weightLabel}>Phase weight</Text>
              <WeightField
                value={p.weight}
                editable
                remaining={budget.remaining + p.weight}
                onCommit={(w) => onSetWeight(p.id, w)}
              />
              <Text style={styles.weightHint}>
                share of the whole project
              </Text>
            </View>
          )}
        </View>
      ))}

      {canManage && (
        <View style={styles.addCard}>
          <TextInput
            style={styles.addInput}
            value={name}
            onChangeText={setName}
            placeholder="Add a phase — e.g. Phase 4 · Support"
            placeholderTextColor={c.textFaint}
            accessibilityLabel="Phase name"
          />
          <View style={styles.addRow}>
            <Text style={styles.weightLabel}>Share</Text>
            <View style={styles.weightBox}>
              <TextInput
                style={styles.weightInput}
                value={weight}
                onChangeText={(v) => setWeight(v.replace(/[^\d.]/g, ""))}
                placeholder={String(budget.remaining)}
                placeholderTextColor={c.textFaint}
                keyboardType="decimal-pad"
                maxLength={5}
                accessibilityLabel="Phase share percent"
              />
              <Text style={styles.weightPct}>%</Text>
            </View>
            <Text style={styles.weightHint}>
              {budget.remaining > 0
                ? `${budget.remaining}% unallocated`
                : "fully allocated"}
            </Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={[styles.addBtn, !name.trim() && { opacity: 0.45 }]}
              disabled={!name.trim() || busy}
              onPress={() => {
                // Blank means "whatever is left", which is what someone
                // adding the last phase almost always wants.
                onAdd(name.trim(), Number(weight) || budget.remaining);
                setName("");
                setWeight("");
              }}
            >
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.addBtnText}>Add phase</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const makeStyles = (c: any) =>
  StyleSheet.create({
    wrap: { gap: 12, marginTop: 14 },
    headCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderRadius: 14,
      padding: 14,
      gap: 10,
    },
    headRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    big: { fontSize: 30, fontWeight: "800", color: c.text },
    sourceLabel: { fontSize: 13, fontWeight: "700", color: c.text },
    derivedNote: { fontSize: 11.5, color: c.textMuted, marginTop: 2 },
    manualPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "rgba(245,158,11,0.14)",
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    manualText: { fontSize: 9.5, fontWeight: "800", color: "#b45309" },
    bigTrack: {
      height: 10,
      borderRadius: 999,
      backgroundColor: c.surfaceMuted,
      justifyContent: "center",
    },
    bigFill: { height: 10, borderRadius: 999 },
    derivedMark: {
      position: "absolute",
      width: 2,
      height: 16,
      borderRadius: 1,
      backgroundColor: c.text,
      opacity: 0.55,
    },
    pinRow: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
    linkBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
    linkText: { fontSize: 12.5, fontWeight: "700", color: c.accent },
    pinEdit: { flexDirection: "row", alignItems: "center", gap: 8 },
    pinInput: {
      width: 62,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 7,
      color: c.text,
      fontSize: 14,
      fontWeight: "700",
      textAlign: "right",
    },
    pinPct: { fontSize: 14, color: c.textMuted, marginLeft: -4 },
    pinSave: {
      backgroundColor: c.accent,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    pinSaveText: { color: "#fff", fontWeight: "800", fontSize: 12.5 },
    pinCancel: { fontSize: 12.5, color: c.textMuted, fontWeight: "600" },
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
    phase: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderRadius: 14,
      padding: 13,
      gap: 9,
    },
    phaseHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    numBadge: {
      width: 24,
      height: 24,
      borderRadius: 7,
      backgroundColor: c.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    numText: { fontSize: 12, fontWeight: "800", color: c.accentText },
    phaseName: { fontSize: 14, fontWeight: "700", color: c.text },
    phaseMeta: { fontSize: 11.5, color: c.textMuted, marginTop: 1 },
    phasePct: { fontSize: 15, fontWeight: "800", color: c.text },
    track: {
      height: 6,
      borderRadius: 999,
      backgroundColor: c.surfaceMuted,
    },
    fill: { height: 6, borderRadius: 999 },
    weightRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    weightLabel: {
      fontSize: 10.5,
      fontWeight: "800",
      color: c.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    weightChip: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 7,
      backgroundColor: c.surfaceMuted,
    },
    weightChipOn: { backgroundColor: c.accentSoft },
    weightText: { fontSize: 11.5, fontWeight: "700", color: c.textMuted },
    weightTextOn: { color: c.accentText },
    weightHint: { fontSize: 10.5, color: c.textFaint, flexShrink: 1 },
    taskList: {
      gap: 2,
      borderTopWidth: 1,
      borderTopColor: c.surfaceBorder,
      paddingTop: 8,
    },
    taskRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 },
    taskTitle: { flex: 1, fontSize: 13, color: c.text },
    taskDone: { color: c.textMuted, textDecorationLine: "line-through" },
    weightBox: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderRadius: 8,
      backgroundColor: c.surface,
      paddingLeft: 9,
    },
    weightPct: { fontSize: 12, color: c.textMuted, fontWeight: "700", paddingRight: 7 },
    addTask: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 9,
      borderRadius: 9,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: c.accent,
    },
    addTaskText: { fontSize: 12.5, fontWeight: "700", color: c.accent },
    budget: { gap: 5 },
    budgetTrack: {
      height: 5,
      borderRadius: 999,
      backgroundColor: c.surfaceMuted,
      overflow: "hidden",
    },
    budgetFill: { height: 5, borderRadius: 999 },
    budgetText: { fontSize: 11, fontWeight: "700", color: c.textMuted },
    weightInput: {
      width: 42,
      paddingVertical: 6,
      paddingHorizontal: 4,
      color: c.text,
      fontSize: 13,
      fontWeight: "700",
      textAlign: "center",
    },
    weightStatic: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 7,
      backgroundColor: c.surfaceMuted,
    },
    weightStaticText: { fontSize: 12, fontWeight: "700", color: c.textMuted },
    addCard: {
      backgroundColor: c.surfaceMuted,
      borderRadius: 14,
      padding: 12,
      gap: 10,
    },
    addInput: {
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: c.surface,
      color: c.text,
      fontSize: 14,
    },
    addRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    addBtn: {
      backgroundColor: c.accent,
      borderRadius: 9,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    addBtnText: { color: "#fff", fontWeight: "800", fontSize: 12.5 },
  });
