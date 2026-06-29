/**
 * StatsCard - Dashboard metric cards for web and mobile.
 *
 * LEARNING POINT: Responsive metric displays
 * Dashboard metrics need different layouts on desktop vs mobile.
 * Desktop: horizontal cards with icons, values, and trend indicators
 * Mobile: compact vertical layout
 *
 * Features:
 * - Animated value changes (web)
 * - Trend indicators (up/down/neutral)
 * - Hover effects for interactive cards
 * - Grid layout helper for multiple cards
 *
 * Usage:
 *   <StatsCardGrid>
 *     <StatsCard
 *       title="Total Employees"
 *       value={152}
 *       icon="people"
 *       trend={{ value: 5, direction: "up" }}
 *     />
 *     <StatsCard
 *       title="Present Today"
 *       value={138}
 *       icon="checkmark-circle"
 *       color="#10B981"
 *     />
 *   </StatsCardGrid>
 */

import React, { ReactNode } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeProvider";
import { useResponsive } from "../utils/responsive";

type IconName = keyof typeof Ionicons.glyphMap;

interface TrendData {
  /** Percentage or value change */
  value: number;
  /** Direction of change */
  direction: "up" | "down" | "neutral";
  /** Label for trend (e.g., "vs last month") */
  label?: string;
}

interface StatsCardProps {
  /** Card title/label */
  title: string;
  /** Numeric value to display */
  value: number | string;
  /** Icon name from Ionicons */
  icon?: IconName;
  /** Accent color for icon background */
  color?: string;
  /** Trend data */
  trend?: TrendData;
  /** Format value (e.g., add currency, percentage) */
  formatValue?: (value: number | string) => string;
  /** Called when card is pressed */
  onPress?: () => void;
  /** Custom content to render instead of value */
  children?: ReactNode;
  /** Make the card span full width on mobile */
  fullWidthMobile?: boolean;
}

export const StatsCard = ({
  title,
  value,
  icon,
  color,
  trend,
  formatValue,
  onPress,
  children,
}: StatsCardProps) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const { isDesktop } = useResponsive();

  const displayValue = formatValue ? formatValue(value) : value.toString();
  const accentColor = color || c.accent;

  const getTrendColor = () => {
    if (!trend) return c.textMuted;
    switch (trend.direction) {
      case "up":
        return "#10B981"; // Green
      case "down":
        return "#EF4444"; // Red
      default:
        return c.textMuted;
    }
  };

  const getTrendIcon = (): IconName => {
    if (!trend) return "remove";
    switch (trend.direction) {
      case "up":
        return "trending-up";
      case "down":
        return "trending-down";
      default:
        return "remove";
    }
  };

  const CardWrapper = onPress ? Pressable : View;

  return (
    <CardWrapper
      onPress={onPress}
      style={({ hovered, pressed }: any) => [
        styles.card,
        {
          backgroundColor: c.surface,
          borderColor: c.surfaceBorder,
        },
        isDesktop && styles.cardDesktop,
        Platform.OS === "web" &&
          onPress &&
          hovered && {
            borderColor: accentColor,
            transform: [{ translateY: -2 }],
          },
        pressed && { opacity: 0.9 },
      ]}
    >
      {/* Icon */}
      {icon && (
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: `${accentColor}15`,
            },
          ]}
        >
          <Ionicons name={icon} size={isDesktop ? 24 : 20} color={accentColor} />
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        <Text
          style={[
            styles.title,
            { color: c.textMuted },
            isDesktop && styles.titleDesktop,
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>

        {children || (
          <Text
            style={[
              styles.value,
              { color: c.text },
              isDesktop && styles.valueDesktop,
            ]}
            numberOfLines={1}
          >
            {displayValue}
          </Text>
        )}

        {/* Trend indicator */}
        {trend && (
          <View style={styles.trendContainer}>
            <Ionicons
              name={getTrendIcon()}
              size={14}
              color={getTrendColor()}
            />
            <Text
              style={[styles.trendValue, { color: getTrendColor() }]}
            >
              {trend.value}%
            </Text>
            {trend.label && (
              <Text style={[styles.trendLabel, { color: c.textMuted }]}>
                {trend.label}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Arrow for clickable cards */}
      {onPress && isDesktop && (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={c.textMuted}
          style={styles.arrow}
        />
      )}
    </CardWrapper>
  );
};

/**
 * StatsCardGrid - Responsive grid layout for stats cards.
 */
interface GridProps {
  children: ReactNode;
  /** Number of columns on desktop (default: 4) */
  columns?: number;
  /** Gap between cards (default: 16) */
  gap?: number;
}

export const StatsCardGrid = ({
  children,
  columns = 4,
  gap = 16,
}: GridProps) => {
  const { isDesktop, isTablet } = useResponsive();

  // Responsive columns: 4 on desktop, 2 on tablet, 1 on mobile
  const actualColumns = isDesktop ? columns : isTablet ? 2 : 1;

  return (
    <View
      style={[
        styles.grid,
        {
          gap,
          ...(Platform.OS === "web" && {
            display: "grid" as any,
            gridTemplateColumns: `repeat(${actualColumns}, 1fr)` as any,
          }),
        },
      ]}
    >
      {children}
    </View>
  );
};

/**
 * MiniStatsCard - A compact inline stat for headers/toolbars.
 */
interface MiniProps {
  label: string;
  value: number | string;
  color?: string;
}

export const MiniStatsCard = ({ label, value, color }: MiniProps) => {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[styles.mini, { backgroundColor: c.surfaceMuted }]}>
      <Text style={[styles.miniLabel, { color: c.textMuted }]}>{label}</Text>
      <Text style={[styles.miniValue, { color: color || c.text }]}>
        {value}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    ...(Platform.OS === "web" && {
      transition: "border-color 0.15s ease, transform 0.15s ease" as any,
      cursor: "default" as any,
    }),
  },
  cardDesktop: {
    padding: 20,
    gap: 16,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  titleDesktop: {
    fontSize: 13,
  },
  value: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 2,
  },
  valueDesktop: {
    fontSize: 28,
  },
  trendContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  trendValue: {
    fontSize: 12,
    fontWeight: "600",
  },
  trendLabel: {
    fontSize: 11,
    marginLeft: 4,
  },
  arrow: {
    marginLeft: 8,
  },

  // Grid styles
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  // Mini card styles
  mini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  miniLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  miniValue: {
    fontSize: 14,
    fontWeight: "700",
  },
});
