/**
 * DataTable - A responsive table component for list views.
 *
 * LEARNING POINT: Adaptive List/Table Display
 * On desktop web, data is often better displayed in a table format.
 * On mobile, cards/rows work better. This component adapts automatically.
 *
 * Features:
 * - Desktop: Full table with columns, sortable headers, hover rows
 * - Mobile: Falls back to card-style rendering
 * - Customizable columns and cell renderers
 * - Built-in hover states for web
 *
 * Usage:
 *   <DataTable
 *     columns={[
 *       { key: "name", label: "Name", width: "30%" },
 *       { key: "status", label: "Status", width: "20%" },
 *     ]}
 *     data={items}
 *     onRowPress={(item) => router.push(`/items/${item.id}`)}
 *     renderMobileRow={(item) => <MyMobileRow item={item} />}
 *   />
 */

import React, { ReactNode } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  DimensionValue,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeProvider";
import { useResponsive } from "../utils/responsive";

export interface Column<T> {
  /** Unique key for the column */
  key: string;
  /** Header label */
  label: string;
  /** Width (percentage or fixed) */
  width?: string | number;
  /** Render function for cell content */
  render?: (item: T, index: number) => ReactNode;
  /** Text alignment */
  align?: "left" | "center" | "right";
  /** Make column sortable */
  sortable?: boolean;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  /** Key extractor for items */
  keyExtractor?: (item: T, index: number) => string;
  /** Called when a row is pressed */
  onRowPress?: (item: T, index: number) => void;
  /** Custom mobile row renderer (falls back to basic list if not provided) */
  renderMobileRow?: (item: T, index: number) => ReactNode;
  /** Show loading state */
  loading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Current sort column */
  sortColumn?: string;
  /** Current sort direction */
  sortDirection?: "asc" | "desc";
  /** Called when sort changes */
  onSortChange?: (column: string, direction: "asc" | "desc") => void;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyExtractor = (item, index) => item.id?.toString() ?? index.toString(),
  onRowPress,
  renderMobileRow,
  loading = false,
  emptyMessage = "No data available",
  sortColumn,
  sortDirection,
  onSortChange,
}: Props<T>) {
  const { theme } = useTheme();
  const { isDesktop } = useResponsive();
  const c = theme.colors;

  // Mobile rendering
  if (!isDesktop) {
    return (
      <View style={styles.mobileContainer}>
        {data.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: c.surface }]}>
            <Ionicons name="document-outline" size={32} color={c.textMuted} />
            <Text style={[styles.emptyText, { color: c.textMuted }]}>
              {emptyMessage}
            </Text>
          </View>
        ) : (
          data.map((item, index) => (
            <View key={keyExtractor(item, index)}>
              {renderMobileRow ? (
                renderMobileRow(item, index)
              ) : (
                <DefaultMobileRow
                  item={item}
                  columns={columns}
                  onPress={onRowPress ? () => onRowPress(item, index) : undefined}
                  theme={theme}
                  index={index}
                  isLast={index === data.length - 1}
                />
              )}
            </View>
          ))
        )}
      </View>
    );
  }

  // Desktop table rendering
  return (
    <View
      style={[
        styles.tableContainer,
        {
          backgroundColor: c.surface,
          borderColor: c.surfaceBorder,
        },
      ]}
    >
      {/* Header Row */}
      <View
        style={[
          styles.headerRow,
          {
            backgroundColor: c.surfaceMuted,
            borderBottomColor: c.surfaceBorder,
          },
        ]}
      >
        {columns.map((col) => (
          <Pressable
            key={col.key}
            style={[
              styles.headerCell,
              { width: col.width as DimensionValue, alignItems: getAlignment(col.align) },
            ]}
            onPress={
              col.sortable && onSortChange
                ? () => {
                    const newDir =
                      sortColumn === col.key && sortDirection === "asc"
                        ? "desc"
                        : "asc";
                    onSortChange(col.key, newDir);
                  }
                : undefined
            }
            disabled={!col.sortable}
          >
            <Text style={[styles.headerText, { color: c.textMuted }]}>
              {col.label}
            </Text>
            {col.sortable && sortColumn === col.key && (
              <Ionicons
                name={sortDirection === "asc" ? "chevron-up" : "chevron-down"}
                size={14}
                color={c.accent}
                style={{ marginLeft: 4 }}
              />
            )}
          </Pressable>
        ))}
      </View>

      {/* Data Rows */}
      <ScrollView style={styles.tableBody}>
        {data.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={32} color={c.textMuted} />
            <Text style={[styles.emptyText, { color: c.textMuted }]}>
              {emptyMessage}
            </Text>
          </View>
        ) : (
          data.map((item, index) => (
            <Pressable
              key={keyExtractor(item, index)}
              style={({ hovered, pressed }: any) => [
                styles.dataRow,
                {
                  borderBottomColor: c.surfaceBorder,
                  borderBottomWidth: index < data.length - 1 ? 1 : 0,
                },
                // Web hover effect
                Platform.OS === "web" &&
                  hovered && {
                    backgroundColor: c.surfaceMuted,
                  },
                pressed && { opacity: 0.8 },
              ]}
              onPress={onRowPress ? () => onRowPress(item, index) : undefined}
            >
              {columns.map((col) => (
                <View
                  key={col.key}
                  style={[
                    styles.dataCell,
                    { width: col.width as DimensionValue, alignItems: getAlignment(col.align) },
                  ]}
                >
                  {col.render ? (
                    col.render(item, index)
                  ) : (
                    <Text
                      style={[styles.cellText, { color: c.text }]}
                      numberOfLines={1}
                    >
                      {item[col.key]?.toString() ?? "—"}
                    </Text>
                  )}
                </View>
              ))}
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

// Default mobile row for when no custom renderer is provided
const DefaultMobileRow = <T extends Record<string, any>>({
  item,
  columns,
  onPress,
  theme,
  index,
  isLast,
}: {
  item: T;
  columns: Column<T>[];
  onPress?: () => void;
  theme: any;
  index: number;
  isLast: boolean;
}) => {
  const c = theme.colors;
  const firstCol = columns[0];
  const restCols = columns.slice(1, 3); // Show first 3 columns on mobile

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }: any) => [
        styles.mobileRow,
        {
          backgroundColor: c.surface,
          borderBottomColor: c.surfaceBorder,
          borderBottomWidth: isLast ? 0 : 1,
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      <View style={styles.mobileRowContent}>
        {/* Primary value */}
        <Text style={[styles.mobileTitle, { color: c.text }]} numberOfLines={1}>
          {firstCol.render
            ? firstCol.render(item, index)
            : item[firstCol.key]?.toString() ?? "—"}
        </Text>
        {/* Secondary values */}
        <View style={styles.mobileMetaRow}>
          {restCols.map((col) => (
            <Text
              key={col.key}
              style={[styles.mobileMeta, { color: c.textMuted }]}
              numberOfLines={1}
            >
              {col.render
                ? col.render(item, index)
                : item[col.key]?.toString() ?? "—"}
            </Text>
          ))}
        </View>
      </View>
      {onPress && (
        <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
      )}
    </Pressable>
  );
};

const getAlignment = (
  align?: "left" | "center" | "right"
): "flex-start" | "center" | "flex-end" => {
  switch (align) {
    case "center":
      return "center";
    case "right":
      return "flex-end";
    default:
      return "flex-start";
  }
};

const styles = StyleSheet.create({
  // Desktop table styles
  tableContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerCell: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  headerText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableBody: {
    maxHeight: 500,
  },
  dataRow: {
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...(Platform.OS === "web" && { cursor: "pointer" as any }),
  },
  dataCell: {
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  cellText: {
    fontSize: 14,
  },

  // Mobile styles
  mobileContainer: {
    gap: 0,
  },
  mobileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  mobileRowContent: {
    flex: 1,
  },
  mobileTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  mobileMetaRow: {
    flexDirection: "row",
    gap: 12,
  },
  mobileMeta: {
    fontSize: 13,
  },

  // Common
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
});
