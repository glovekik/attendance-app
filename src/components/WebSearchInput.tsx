/**
 * WebSearchInput - A desktop-optimized search input with keyboard shortcuts.
 *
 * LEARNING POINT: Web-specific input enhancements
 * On desktop web, users expect keyboard shortcuts and visual feedback.
 * This component provides a search input that:
 * - Shows keyboard shortcut hint (press "/" to focus)
 * - Has smooth focus/blur transitions
 * - Includes clear button when text is present
 * - Integrates with the theme system
 *
 * Usage:
 *   <WebSearchInput
 *     value={search}
 *     onChangeText={setSearch}
 *     placeholder="Search employees..."
 *   />
 */

import React, { useRef, useEffect, useCallback } from "react";
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeProvider";

interface Props {
  /** Current search value */
  value: string;
  /** Called when search value changes */
  onChangeText: (text: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Width of the input (default: 280) */
  width?: number | string;
  /** Enable "/" keyboard shortcut to focus (default: true on web) */
  enableShortcut?: boolean;
  /** Called when search is submitted (Enter key) */
  onSubmit?: () => void;
  /** Auto-focus on mount */
  autoFocus?: boolean;
}

export const WebSearchInput = ({
  value,
  onChangeText,
  placeholder = "Search...",
  width = 280,
  enableShortcut = Platform.OS === "web",
  onSubmit,
  autoFocus = false,
}: Props) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const inputRef = useRef<TextInput>(null);

  // Handle "/" shortcut to focus search
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // "/" key focuses search
      if (event.key === "/" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    },
    []
  );

  useEffect(() => {
    if (!enableShortcut || Platform.OS !== "web") return;

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enableShortcut, handleKeyDown]);

  const handleClear = () => {
    onChangeText("");
    inputRef.current?.focus();
  };

  const handleSubmitEditing = () => {
    onSubmit?.();
  };

  return (
    <View
      style={[
        styles.container,
        {
          width: width as any,
          backgroundColor: c.surfaceMuted,
          borderColor: c.surfaceBorder,
        },
      ]}
    >
      {/* Search Icon */}
      <Ionicons
        name="search-outline"
        size={18}
        color={c.textMuted}
        style={styles.searchIcon}
      />

      {/* Input */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        onSubmitEditing={handleSubmitEditing}
        autoFocus={autoFocus}
        style={[
          styles.input,
          {
            color: c.text,
          },
        ]}
        returnKeyType="search"
      />

      {/* Right side: Clear button or shortcut hint */}
      {value.length > 0 ? (
        <Pressable
          onPress={handleClear}
          style={({ hovered }: any) => [
            styles.clearButton,
            hovered && { opacity: 0.7 },
          ]}
          hitSlop={8}
        >
          <Ionicons name="close-circle" size={18} color={c.textMuted} />
        </Pressable>
      ) : enableShortcut ? (
        <View style={[styles.shortcutHint, { borderColor: c.surfaceBorder }]}>
          <Ionicons name="return-down-back" size={12} color={c.textMuted} />
        </View>
      ) : null}
    </View>
  );
};

/**
 * SearchInputInline - A minimal inline search for tables/lists.
 */
interface InlineProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export const SearchInputInline = ({
  value,
  onChangeText,
  placeholder = "Filter...",
}: InlineProps) => {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[styles.inlineContainer, { borderColor: c.surfaceBorder }]}>
      <Ionicons
        name="filter-outline"
        size={14}
        color={c.textMuted}
        style={{ marginRight: 6 }}
      />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        style={[styles.inlineInput, { color: c.text }]}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText("")} hitSlop={8}>
          <Ionicons name="close" size={14} color={c.textMuted} />
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 40,
    ...(Platform.OS === "web" && {
      transition: "border-color 0.15s ease, box-shadow 0.15s ease" as any,
    }),
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    height: "100%",
    ...(Platform.OS === "web" && {
      outlineStyle: "none" as any,
    }),
  },
  clearButton: {
    marginLeft: 8,
    padding: 2,
  },
  shortcutHint: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },

  // Inline variant styles
  inlineContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  inlineInput: {
    flex: 1,
    fontSize: 13,
    ...(Platform.OS === "web" && {
      outlineStyle: "none" as any,
    }),
  },
});
