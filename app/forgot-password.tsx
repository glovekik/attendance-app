import React, { useState, useMemo } from "react";

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
  DimensionValue,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import { requestPasswordReset } from "../src/services/api";

import { useTheme } from "../src/theme/ThemeProvider";
import { useResponsive } from "../src/utils/responsive";

export default function ForgotPassword() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;

  const responsive = useResponsive();
  const isDesktop = responsive.isDesktop;

  const s = useMemo(() => makeStyles(c, isDesktop), [c, isDesktop]);

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (submitting) return;

    if (!email.trim()) {
      setError("Email required");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await requestPasswordReset(email.trim());
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || "Could not request reset");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.cardWrap}>
            {!isDesktop && (
              <TouchableOpacity
                style={s.backBtn}
                onPress={() =>
                  router.canGoBack() ? router.back() : router.replace("/")
                }
              >
                <Ionicons name="chevron-back" size={22} color={c.text} />
              </TouchableOpacity>
            )}

            <View style={s.iconWrap}>
              <Ionicons name="lock-closed-outline" size={48} color={c.accent} />
            </View>

            <Text style={s.title}>Forgot password?</Text>
            <Text style={s.subtitle}>
              {submitted
                ? "If an account exists for that email, we've sent reset instructions. Check your inbox."
                : "Enter the email you use for your account and we'll send a reset link."}
            </Text>

            {!submitted && (
              <>
                <Text style={s.label}>Email</Text>
                <TextInput
                  style={s.input}
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    setError("");
                  }}
                  placeholder="you@company.com"
                  placeholderTextColor={c.textFaint}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!submitting}
                />

                {error ? <Text style={s.err}>{error}</Text> : null}

                <TouchableOpacity
                  style={[s.primary, submitting && { opacity: 0.7 }]}
                  onPress={submit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.primaryText}>Send reset link</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {submitted && (
              <>
                <TouchableOpacity
                  style={s.primary}
                  onPress={() => router.push("/reset-password")}
                >
                  <Text style={s.primaryText}>I have a token</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.secondary}
                  onPress={() => router.replace("/login")}
                >
                  <Text style={s.secondaryText}>Back to login</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: any, isDesktop: boolean) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#020617" },
    content: {
      padding: isDesktop ? 40 : 24,
      paddingTop: isDesktop ? 80 : 60,
      flexGrow: 1,
      alignItems: isDesktop ? "center" : undefined,
      justifyContent: isDesktop ? "center" : undefined,
    },
    cardWrap: {
      width: isDesktop ? 420 : ("100%" as DimensionValue),
      maxWidth: isDesktop ? 420 : undefined,
      backgroundColor: isDesktop ? c.surface : "transparent",
      borderRadius: isDesktop ? 20 : 0,
      borderWidth: isDesktop ? 1 : 0,
      borderColor: isDesktop ? c.surfaceBorder : "transparent",
      padding: isDesktop ? 32 : 0,
      ...(Platform.OS === "web" && isDesktop
        ? {
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          }
        : {}),
    },
    backBtn: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: c.surface,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      marginBottom: 30,
    },
    iconWrap: {
      width: isDesktop ? 88 : 80,
      height: isDesktop ? 88 : 80,
      borderRadius: isDesktop ? 44 : 40,
      backgroundColor: "rgba(37,99,235,0.12)",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: isDesktop ? 24 : 18,
      alignSelf: isDesktop ? "center" : undefined,
    },
    title: {
      color: c.text,
      fontSize: isDesktop ? 28 : 26,
      fontWeight: "800",
      marginBottom: isDesktop ? 12 : 10,
      textAlign: isDesktop ? "center" : undefined,
    },
    subtitle: {
      color: c.textMuted,
      fontSize: isDesktop ? 15 : 14,
      lineHeight: isDesktop ? 22 : 20,
      marginBottom: isDesktop ? 32 : 26,
      textAlign: isDesktop ? "center" : undefined,
    },
    label: {
      color: c.text,
      fontSize: isDesktop ? 14 : 13,
      fontWeight: "600",
      marginBottom: 8,
      marginTop: 6,
    },
    input: {
      backgroundColor: c.surfaceMuted,
      color: c.text,
      paddingVertical: isDesktop ? 16 : 14,
      paddingHorizontal: 16,
      borderRadius: isDesktop ? 12 : 14,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      fontSize: isDesktop ? 16 : 15,
      ...(Platform.OS === "web"
        ? ({
            outlineStyle: "none",
            transition: "border-color 0.15s ease",
          } as any)
        : {}),
    },
    err: {
      color: "#fca5a5",
      fontSize: 13,
      marginTop: 8,
    },
    primary: {
      backgroundColor: c.accent,
      paddingVertical: isDesktop ? 16 : 15,
      borderRadius: isDesktop ? 12 : 14,
      alignItems: "center",
      marginTop: isDesktop ? 28 : 24,
      ...(Platform.OS === "web"
        ? {
            cursor: "pointer",
            transition: "opacity 0.15s ease",
          }
        : {}),
    },
    primaryText: {
      color: "#fff",
      fontSize: isDesktop ? 16 : 15,
      fontWeight: "700",
    },
    secondary: {
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
      marginTop: 12,
      ...(Platform.OS === "web"
        ? {
            cursor: "pointer",
          }
        : {}),
    },
    secondaryText: {
      color: c.textMuted,
      fontSize: 14,
      fontWeight: "600",
    },
  });
