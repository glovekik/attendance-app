/**
 * CommandPalette - Quick navigation modal (Cmd+K).
 *
 * LEARNING POINT: Desktop Command Palette
 * Modern desktop apps use command palettes for quick navigation.
 * Press Cmd/Ctrl+K to open, type to search, Enter to navigate.
 *
 * Features:
 * - Fuzzy search across all app screens
 * - Role-aware commands (shows different options for HR/Manager/Employee)
 * - Recent items
 * - Keyboard navigation (arrow keys + enter)
 *
 * Usage:
 *   <CommandPalette
 *     visible={showPalette}
 *     onClose={() => setShowPalette(false)}
 *     user={user}
 *   />
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Modal,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeProvider";
import { User, hasRole, isManager, isCEO } from "../types";

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  keywords?: string[];
  section: "navigation" | "actions" | "admin";
  roles?: ("USER" | "HR" | "MANAGER" | "CEO")[];
}

// All available commands
const ALL_COMMANDS: Command[] = [
  // Navigation - Everyone
  {
    id: "home",
    label: "Home",
    description: "Dashboard overview",
    icon: "home-outline",
    route: "/",
    keywords: ["dashboard", "main"],
    section: "navigation",
  },
  {
    id: "attendance",
    label: "Attendance",
    description: "Check in/out, view history",
    icon: "calendar-outline",
    route: "/attendance",
    keywords: ["checkin", "checkout", "clock"],
    section: "navigation",
  },
  {
    id: "tasks",
    label: "Tasks",
    description: "View and manage tasks",
    icon: "checkbox-outline",
    route: "/tasks",
    keywords: ["todo", "work"],
    section: "navigation",
  },
  {
    id: "leaves",
    label: "Leaves",
    description: "Request and view leaves",
    icon: "airplane-outline",
    route: "/leaves",
    keywords: ["vacation", "time off", "pto"],
    section: "navigation",
  },
  {
    id: "profile",
    label: "Profile",
    description: "Your profile settings",
    icon: "person-outline",
    route: "/profile",
    keywords: ["settings", "account"],
    section: "navigation",
  },
  {
    id: "chat",
    label: "Office Chat",
    description: "Team messaging",
    icon: "chatbubbles-outline",
    route: "/chat/office",
    keywords: ["message", "team"],
    section: "navigation",
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "View all notifications",
    icon: "notifications-outline",
    route: "/notifications",
    keywords: ["alerts", "inbox"],
    section: "navigation",
  },
  {
    id: "reimbursements",
    label: "Reimbursements",
    description: "Expense reimbursement requests",
    icon: "card-outline",
    route: "/reimbursements",
    keywords: ["expense", "money"],
    section: "navigation",
  },
  {
    id: "documents",
    label: "My Documents",
    description: "Upload and view documents",
    icon: "folder-outline",
    route: "/my-documents",
    keywords: ["files", "upload"],
    section: "navigation",
  },
  {
    id: "payroll",
    label: "My Payroll",
    description: "Salary slips and payroll info",
    icon: "wallet-outline",
    route: "/my-payroll",
    keywords: ["salary", "pay"],
    section: "navigation",
  },

  // Manager commands
  {
    id: "manager-approvals",
    label: "Manager Approvals",
    description: "Pending leave and expense approvals",
    icon: "checkmark-done-outline",
    route: "/manager",
    keywords: ["approve", "pending"],
    section: "admin",
    roles: ["MANAGER", "HR", "CEO"],
  },
  {
    id: "manager-team",
    label: "My Team",
    description: "Team attendance and productivity",
    icon: "people-outline",
    route: "/manager-team",
    keywords: ["team", "reports"],
    section: "admin",
    roles: ["MANAGER", "HR", "CEO"],
  },

  // HR commands
  {
    id: "hr-admin",
    label: "HR Admin Console",
    description: "Full HR management",
    icon: "briefcase-outline",
    route: "/hr-admin",
    keywords: ["admin", "hr"],
    section: "admin",
    roles: ["HR", "CEO"],
  },
  {
    id: "hr-attendance",
    label: "HR Attendance",
    description: "Company-wide attendance",
    icon: "time-outline",
    route: "/hr-attendance",
    keywords: ["all attendance"],
    section: "admin",
    roles: ["HR", "CEO"],
  },
  {
    id: "hr-reports",
    label: "Reports",
    description: "Analytics and reports",
    icon: "bar-chart-outline",
    route: "/hr-reports",
    keywords: ["analytics", "stats"],
    section: "admin",
    roles: ["HR", "CEO"],
  },
  {
    id: "users",
    label: "Employees",
    description: "Employee directory",
    icon: "people-outline",
    route: "/users",
    keywords: ["staff", "directory"],
    section: "admin",
    roles: ["HR", "CEO"],
  },

  // CEO commands
  {
    id: "ceo-console",
    label: "CEO Console",
    description: "Executive KPIs and overview",
    icon: "trending-up-outline",
    route: "/ceo",
    keywords: ["executive", "kpi"],
    section: "admin",
    roles: ["CEO"],
  },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  user: User | null;
}

export const CommandPalette = ({ visible, onClose, user }: Props) => {
  const { theme } = useTheme();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const c = theme.colors;

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter commands based on user role
  const availableCommands = useMemo(() => {
    return ALL_COMMANDS.filter((cmd) => {
      if (!cmd.roles) return true;
      if (!user) return false;
      if (hasRole(user, "HR") && cmd.roles.includes("HR")) return true;
      if (isCEO(user) && cmd.roles.includes("CEO")) return true;
      if (isManager(user) && cmd.roles.includes("MANAGER")) return true;
      if (cmd.roles.includes("USER")) return true;
      return false;
    });
  }, [user]);

  // Filter by search query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return availableCommands;
    const q = query.toLowerCase();
    return availableCommands.filter((cmd) => {
      if (cmd.label.toLowerCase().includes(q)) return true;
      if (cmd.description?.toLowerCase().includes(q)) return true;
      if (cmd.keywords?.some((k) => k.includes(q))) return true;
      return false;
    });
  }, [availableCommands, query]);

  // Reset state when opened
  useEffect(() => {
    if (visible) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible]);

  // Keyboard navigation
  useEffect(() => {
    if (!visible || Platform.OS !== "web") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cmd = filteredCommands[selectedIndex];
        if (cmd) {
          router.push(cmd.route as any);
          onClose();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [visible, filteredCommands, selectedIndex, router, onClose]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands.length]);

  const handleSelect = (cmd: Command) => {
    router.push(cmd.route as any);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.palette, { backgroundColor: c.surface, borderColor: c.surfaceBorder }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Search Input */}
          <View style={[styles.searchRow, { borderBottomColor: c.surfaceBorder }]}>
            <Ionicons name="search-outline" size={20} color={c.textMuted} />
            <TextInput
              ref={inputRef}
              style={[styles.input, { color: c.text }]}
              placeholder="Search commands..."
              placeholderTextColor={c.textFaint}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            <View style={[styles.shortcut, { backgroundColor: c.surfaceMuted }]}>
              <Text style={[styles.shortcutText, { color: c.textMuted }]}>ESC</Text>
            </View>
          </View>

          {/* Results */}
          <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
            {filteredCommands.length === 0 ? (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: c.textMuted }]}>
                  No commands found
                </Text>
              </View>
            ) : (
              filteredCommands.map((cmd, index) => (
                <Pressable
                  key={cmd.id}
                  onPress={() => handleSelect(cmd)}
                  style={({ hovered }: any) => [
                    styles.item,
                    selectedIndex === index && { backgroundColor: c.accentSoft },
                    Platform.OS === "web" && hovered && { backgroundColor: c.surfaceMuted },
                  ]}
                >
                  <View style={[styles.itemIcon, { backgroundColor: c.surfaceMuted }]}>
                    <Ionicons name={cmd.icon} size={18} color={c.textMuted} />
                  </View>
                  <View style={styles.itemContent}>
                    <Text style={[styles.itemLabel, { color: c.text }]}>{cmd.label}</Text>
                    {cmd.description && (
                      <Text style={[styles.itemDesc, { color: c.textMuted }]}>
                        {cmd.description}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="return-down-back-outline" size={16} color={c.textFaint} />
                </Pressable>
              ))
            )}
          </ScrollView>

          {/* Footer hint */}
          <View style={[styles.footer, { borderTopColor: c.surfaceBorder }]}>
            <Text style={[styles.footerText, { color: c.textFaint }]}>
              <Text style={{ fontWeight: "600" }}>↑↓</Text> Navigate{" "}
              <Text style={{ fontWeight: "600" }}>↵</Text> Select{" "}
              <Text style={{ fontWeight: "600" }}>ESC</Text> Close
            </Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 100,
  },
  palette: {
    width: "100%",
    maxWidth: 560,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    ...(Platform.OS === "web" && { outlineStyle: "none" as any }),
  },
  shortcut: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  shortcutText: {
    fontSize: 11,
    fontWeight: "600",
  },
  results: {
    maxHeight: 400,
  },
  empty: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    ...(Platform.OS === "web" && { cursor: "pointer" as any }),
  },
  itemIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  itemContent: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  itemDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  footer: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
  },
});
