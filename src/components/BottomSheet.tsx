/**
 * BottomSheet - Responsive bottom sheet / side panel component.
 *
 * LEARNING POINT: Platform-adaptive panels
 * Mobile: Classic bottom sheet that slides up from bottom
 * Desktop: Side panel that slides in from the right (more natural for desktop)
 *
 * Features:
 * - Swipe to dismiss on mobile (via gesture)
 * - Click-outside to dismiss
 * - Keyboard dismissable (Escape key)
 * - Multiple height presets for mobile
 * - Configurable width for desktop panel
 *
 * Usage:
 *   <BottomSheet
 *     visible={showSheet}
 *     onClose={() => setShowSheet(false)}
 *     title="Filter Options"
 *   >
 *     <YourContent />
 *   </BottomSheet>
 */

import React, { useEffect, useCallback, ReactNode } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  Dimensions,
  DimensionValue,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeProvider";
import { useResponsive } from "../utils/responsive";

type SheetHeight = "auto" | "half" | "full";

interface Props {
  /** Whether the sheet is visible */
  visible: boolean;
  /** Called when sheet should close */
  onClose: () => void;
  /** Sheet title (optional) */
  title?: string;
  /** Sheet content */
  children: ReactNode;
  /** Height preset for mobile (default: auto) */
  height?: SheetHeight;
  /** Width for desktop side panel (default: 400) */
  desktopWidth?: number;
  /** Show handle bar on mobile (default: true) */
  showHandle?: boolean;
  /** Disable closing by clicking backdrop (default: false) */
  disableBackdropClose?: boolean;
  /** Footer content */
  footer?: ReactNode;
  /** Use modal style on desktop instead of side panel */
  useModalOnDesktop?: boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const HEIGHT_MAP: Record<SheetHeight, DimensionValue> = {
  auto: "auto" as DimensionValue,
  half: SCREEN_HEIGHT * 0.5,
  full: SCREEN_HEIGHT * 0.9,
};

export const BottomSheet = ({
  visible,
  onClose,
  title,
  children,
  height = "auto",
  desktopWidth = 400,
  showHandle = true,
  disableBackdropClose = false,
  footer,
  useModalOnDesktop = false,
}: Props) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const { isDesktop } = useResponsive();

  // Handle Escape key on web
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape" && visible) {
        onClose();
      }
    },
    [visible, onClose]
  );

  useEffect(() => {
    if (Platform.OS !== "web") return;

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Prevent body scroll when sheet is open (web only)
  useEffect(() => {
    if (Platform.OS !== "web" || !visible) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [visible]);

  const handleBackdropPress = () => {
    if (!disableBackdropClose) {
      onClose();
    }
  };

  // Desktop: side panel from right
  // Mobile: bottom sheet
  const useSidePanel = isDesktop && !useModalOnDesktop;

  const containerStyle = useSidePanel
    ? styles.sidePanelContainer
    : styles.bottomSheetContainer;

  const sheetStyle = useSidePanel
    ? [
        styles.sidePanel,
        {
          width: desktopWidth,
          backgroundColor: c.surface,
          borderLeftColor: c.surfaceBorder,
        },
      ]
    : [
        styles.bottomSheet,
        {
          backgroundColor: c.surface,
          maxHeight: HEIGHT_MAP[height],
        },
      ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType={useSidePanel ? "fade" : "slide"}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable
        style={[styles.backdrop, { backgroundColor: c.overlay }]}
        onPress={handleBackdropPress}
      />

      {/* Sheet Container */}
      <View style={containerStyle} pointerEvents="box-none">
        {/* Sheet */}
        <View style={sheetStyle}>
          {/* Handle (mobile only) */}
          {!useSidePanel && showHandle && (
            <View style={styles.handleContainer}>
              <View style={[styles.handle, { backgroundColor: c.surfaceBorder }]} />
            </View>
          )}

          {/* Header */}
          {title && (
            <View
              style={[
                styles.header,
                { borderBottomColor: c.surfaceBorder },
              ]}
            >
              <Text style={[styles.title, { color: c.text }]}>{title}</Text>

              <Pressable
                onPress={onClose}
                style={({ hovered, pressed }: any) => [
                  styles.closeButton,
                  { backgroundColor: c.surfaceMuted },
                  Platform.OS === "web" && hovered && {
                    backgroundColor: c.surfaceBorder,
                  },
                  pressed && { opacity: 0.7 },
                ]}
                hitSlop={8}
              >
                <Ionicons name="close" size={18} color={c.textMuted} />
              </Pressable>
            </View>
          )}

          {/* Content */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentInner}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          {/* Footer */}
          {footer && (
            <View
              style={[
                styles.footer,
                { borderTopColor: c.surfaceBorder },
              ]}
            >
              {footer}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

/**
 * ActionSheet - Quick action picker (like iOS action sheets).
 */
interface ActionItem {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  actions: ActionItem[];
}

export const ActionSheet = ({
  visible,
  onClose,
  title,
  actions,
}: ActionSheetProps) => {
  const { theme } = useTheme();
  const c = theme.colors;

  const handleAction = (action: ActionItem) => {
    if (action.disabled) return;
    onClose();
    action.onPress();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      height="auto"
      useModalOnDesktop
    >
      <View style={styles.actionList}>
        {actions.map((action, index) => (
          <Pressable
            key={index}
            onPress={() => handleAction(action)}
            disabled={action.disabled}
            style={({ hovered, pressed }: any) => [
              styles.actionItem,
              { borderBottomColor: c.surfaceBorder },
              index === actions.length - 1 && { borderBottomWidth: 0 },
              action.disabled && { opacity: 0.5 },
              Platform.OS === "web" && hovered && {
                backgroundColor: c.surfaceMuted,
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            {action.icon && (
              <Ionicons
                name={action.icon}
                size={20}
                color={action.destructive ? c.dangerText : c.text}
                style={styles.actionIcon}
              />
            )}
            <Text
              style={[
                styles.actionLabel,
                { color: action.destructive ? c.dangerText : c.text },
              ]}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}

        {/* Cancel button */}
        <Pressable
          onPress={onClose}
          style={({ hovered, pressed }: any) => [
            styles.cancelButton,
            { backgroundColor: c.surfaceMuted },
            Platform.OS === "web" && hovered && {
              backgroundColor: c.surfaceBorder,
            },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[styles.cancelText, { color: c.text }]}>Cancel</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },

  // Bottom sheet styles (mobile)
  bottomSheetContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  bottomSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },

  // Side panel styles (desktop)
  sidePanelContainer: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  sidePanel: {
    height: "100%",
    borderLeftWidth: 1,
    ...(Platform.OS === "web" && {
      animation: "slideInRight 0.2s ease" as any,
    }),
  },

  // Handle
  handleContainer: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web" && {
      transition: "background-color 0.15s ease" as any,
      cursor: "pointer" as any,
    }),
  },

  // Content
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 20,
  },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },

  // Action sheet
  actionList: {
    paddingBottom: 8,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    ...(Platform.OS === "web" && {
      cursor: "pointer" as any,
      transition: "background-color 0.15s ease" as any,
    }),
  },
  actionIcon: {
    marginRight: 12,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    ...(Platform.OS === "web" && {
      cursor: "pointer" as any,
      transition: "background-color 0.15s ease" as any,
    }),
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
