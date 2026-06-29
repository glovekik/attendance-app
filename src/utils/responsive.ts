/**
 * Responsive utilities for React Native Web.
 *
 * These utilities help create platform-aware layouts:
 * - Mobile (<768px): Phone-optimized with bottom tabs
 * - Tablet (768-1024px): Compact sidebar with icons
 * - Desktop (>1024px): Full sidebar with labels
 *
 * LEARNING POINT:
 * React Native Web supports Dimensions API and Platform checks.
 * We use these to create responsive breakpoints similar to CSS media queries.
 */

import { Dimensions, Platform } from "react-native";
import { useState, useEffect } from "react";

const { width, height } = Dimensions.get("window");

// Original percentage-based utilities
export const wp = (percent: number) => (width * percent) / 100;
export const hp = (percent: number) => (height * percent) / 100;

// ============================================================================
// DESKTOP WEB RESPONSIVE UTILITIES
// ============================================================================

// Breakpoints (in pixels)
export const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  wide: 1400,
} as const;

export type Breakpoint = "mobile" | "tablet" | "desktop" | "wide";

/**
 * Get the current breakpoint based on screen width.
 */
export const getBreakpoint = (width: number): Breakpoint => {
  if (width >= BREAKPOINTS.wide) return "wide";
  if (width >= BREAKPOINTS.desktop) return "desktop";
  if (width >= BREAKPOINTS.tablet) return "tablet";
  return "mobile";
};

/**
 * Check if we're on a desktop-class screen (web + wide enough).
 * Mobile apps always return false regardless of screen size.
 */
export const isDesktopWeb = (): boolean => {
  if (Platform.OS !== "web") return false;
  const { width } = Dimensions.get("window");
  return width >= BREAKPOINTS.tablet;
};

/**
 * Hook to get responsive values based on current screen width.
 * Re-renders when the window is resized.
 *
 * LEARNING POINT:
 * This hook listens to Dimensions changes (works on web via resize events).
 * Returns the current breakpoint so components can adapt their layout.
 */
export const useResponsive = () => {
  const [dimensions, setDimensions] = useState(() => Dimensions.get("window"));

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setDimensions(window);
    });
    return () => subscription.remove();
  }, []);

  const breakpoint = getBreakpoint(dimensions.width);

  return {
    width: dimensions.width,
    height: dimensions.height,
    breakpoint,
    isMobile: breakpoint === "mobile",
    isTablet: breakpoint === "tablet",
    isDesktop: breakpoint === "desktop" || breakpoint === "wide",
    isWide: breakpoint === "wide",
    // Show sidebar navigation instead of bottom tabs
    showSidebar: Platform.OS === "web" && dimensions.width >= BREAKPOINTS.tablet,
    // Show collapsed sidebar (icons only) on tablet
    sidebarCollapsed: breakpoint === "tablet",
  };
};

/**
 * Get responsive spacing values based on breakpoint.
 */
export const getResponsiveSpacing = (breakpoint: Breakpoint) => {
  switch (breakpoint) {
    case "wide":
      return { padding: 32, gap: 24, maxWidth: 1400 };
    case "desktop":
      return { padding: 24, gap: 20, maxWidth: 1200 };
    case "tablet":
      return { padding: 20, gap: 16, maxWidth: 900 };
    default:
      return { padding: 16, gap: 12, maxWidth: undefined };
  }
};

/**
 * Sidebar width constants for layout calculations.
 */
export const SIDEBAR_WIDTH = {
  collapsed: 72, // Icons only (tablet)
  expanded: 260, // Full sidebar with labels (desktop)
} as const;