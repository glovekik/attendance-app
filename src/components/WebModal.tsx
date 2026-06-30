/**
 * WebModal - Responsive modal/dialog component for web and mobile.
 *
 * LEARNING POINT: Platform-adaptive modals
 * Mobile: Slides up from bottom (native feel), full-width
 * Desktop: Centered dialog with backdrop, constrained width
 *
 * Features:
 * - Smooth animations (slide on mobile, fade on desktop)
 * - Click-outside to dismiss on desktop
 * - Escape key to close on web
 * - Focus trap for accessibility
 * - Multiple size presets
 *
 * Usage:
 *   <WebModal
 *     visible={showModal}
 *     onClose={() => setShowModal(false)}
 *     title="Edit Profile"
 *     size="md"
 *   >
 *     <YourContent />
 *   </WebModal>
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
  KeyboardAvoidingView,
  DimensionValue,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeProvider";
import { useResponsive } from "../utils/responsive";

type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

interface Props {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when modal should close */
  onClose: () => void;
  /** Modal title (optional) */
  title?: string;
  /** Modal subtitle (optional) */
  subtitle?: string;
  /** Modal content */
  children: ReactNode;
  /** Size preset (default: md) */
  size?: ModalSize;
  /** Show close button (default: true) */
  showCloseButton?: boolean;
  /** Disable closing by clicking backdrop (default: false) */
  disableBackdropClose?: boolean;
  /** Footer content (buttons, etc.) */
  footer?: ReactNode;
  /** Make content scrollable (default: true) */
  scrollable?: boolean;
}

const SIZE_MAP: Record<ModalSize, number> = {
  sm: 400,
  md: 520,
  lg: 680,
  xl: 900,
  full: Dimensions.get("window").width * 0.95,
};

export const WebModal = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  size = "md",
  showCloseButton = true,
  disableBackdropClose = false,
  footer,
  scrollable = true,
}: Props) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const { isDesktop, isMobile } = useResponsive();

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

  // Prevent body scroll when modal is open (web only)
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

  const modalWidth: DimensionValue = isMobile
    ? "100%"
    : Math.min(SIZE_MAP[size], Dimensions.get("window").width - 48);

  // Desktop: centered dialog
  // Mobile: bottom sheet style
  const containerStyle = isDesktop
    ? styles.desktopContainer
    : styles.mobileContainer;

  const cardStyle = isDesktop
    ? [
        styles.desktopCard,
        {
          width: modalWidth,
          backgroundColor: c.surface,
          borderColor: c.surfaceBorder,
        },
      ]
    : [
        styles.mobileCard,
        {
          backgroundColor: c.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
        },
      ];

  const ContentWrapper = scrollable ? ScrollView : View;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isDesktop ? "fade" : "slide"}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        // iOS lifts with "padding"; Android needs "height" (was previously
        // undefined, so Android forms got covered by the keyboard). Web has
        // no soft keyboard, so this is a no-op there.
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        style={{ flex: 1 }}
      >
        {/* Backdrop */}
        <Pressable
          style={[styles.backdrop, { backgroundColor: c.overlay }]}
          onPress={handleBackdropPress}
        />

        {/* Modal Container */}
        <View style={containerStyle} pointerEvents="box-none">
          {/* Modal Card */}
          <View style={cardStyle}>
            {/* Header */}
            {(title || showCloseButton) && (
              <View
                style={[
                  styles.header,
                  { borderBottomColor: c.surfaceBorder },
                ]}
              >
                <View style={styles.headerText}>
                  {title && (
                    <Text style={[styles.title, { color: c.text }]}>
                      {title}
                    </Text>
                  )}
                  {subtitle && (
                    <Text style={[styles.subtitle, { color: c.textMuted }]}>
                      {subtitle}
                    </Text>
                  )}
                </View>

                {showCloseButton && (
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
                )}
              </View>
            )}

            {/* Content */}
            <ContentWrapper
              style={styles.content}
              contentContainerStyle={scrollable ? styles.contentInner : undefined}
              showsVerticalScrollIndicator={false}
              // Let buttons/inputs receive the tap on the first touch while
              // the keyboard is open, instead of just dismissing it.
              {...(scrollable
                ? { keyboardShouldPersistTaps: "handled" as const }
                : {})}
            >
              {children}
            </ContentWrapper>

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
      </KeyboardAvoidingView>
    </Modal>
  );
};

/**
 * ModalActions - Standard button row for modal footers.
 */
interface ActionsProps {
  children: ReactNode;
  align?: "left" | "center" | "right" | "spread";
}

export const ModalActions = ({ children, align = "right" }: ActionsProps) => {
  const alignMap = {
    left: "flex-start",
    center: "center",
    right: "flex-end",
    spread: "space-between",
  } as const;

  return (
    <View
      style={[
        styles.actions,
        { justifyContent: alignMap[align] },
      ]}
    >
      {children}
    </View>
  );
};

/**
 * ConfirmModal - Pre-built confirmation dialog.
 */
interface ConfirmProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  loading?: boolean;
}

export const ConfirmModal = ({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  destructive = false,
  loading = false,
}: ConfirmProps) => {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <WebModal
      visible={visible}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <ModalActions align="right">
          <Pressable
            onPress={onClose}
            style={({ hovered }: any) => [
              styles.button,
              styles.buttonSecondary,
              { borderColor: c.surfaceBorder },
              hovered && { backgroundColor: c.surfaceMuted },
            ]}
          >
            <Text style={[styles.buttonText, { color: c.text }]}>
              {cancelText}
            </Text>
          </Pressable>

          <Pressable
            onPress={onConfirm}
            disabled={loading}
            style={({ hovered, pressed }: any) => [
              styles.button,
              styles.buttonPrimary,
              {
                backgroundColor: destructive ? c.dangerText : c.accent,
                opacity: loading ? 0.7 : 1,
              },
              hovered && { opacity: 0.9 },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={[styles.buttonText, { color: c.textInverse }]}>
              {loading ? "..." : confirmText}
            </Text>
          </Pressable>
        </ModalActions>
      }
    >
      <Text style={[styles.message, { color: c.textMuted }]}>{message}</Text>
    </WebModal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },

  // Desktop styles
  desktopContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  desktopCard: {
    borderRadius: 16,
    borderWidth: 1,
    maxHeight: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    ...(Platform.OS === "web" && {
      boxShadow: "0 8px 24px rgba(0,0,0,0.15)" as any,
    }),
  },

  // Mobile styles (bottom sheet)
  mobileContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  mobileCard: {
    maxHeight: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    gap: 16,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
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
    flexGrow: 1,
    flexShrink: 1,
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

  // Actions
  actions: {
    flexDirection: "row",
    gap: 12,
  },

  // Buttons
  button: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    ...(Platform.OS === "web" && {
      cursor: "pointer" as any,
      transition: "opacity 0.15s ease, background-color 0.15s ease" as any,
    }),
  },
  buttonPrimary: {
    minWidth: 100,
    alignItems: "center",
  },
  buttonSecondary: {
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // Confirm modal
  message: {
    fontSize: 15,
    lineHeight: 22,
  },
});
