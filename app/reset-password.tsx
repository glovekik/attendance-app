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

import { useRouter, useLocalSearchParams } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import { resetPassword } from "../src/services/api";

import { useTheme } from "../src/theme/ThemeProvider";
import { useResponsive } from "../src/utils/responsive";

export default function ResetPassword() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;

  const responsive = useResponsive();
  const isDesktop = responsive.isDesktop;

  const s = useMemo(() => makeStyles(c, isDesktop), [c, isDesktop]);
  const params = useLocalSearchParams();

  const [token, setToken] = useState((params.token as string) || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (submitting) return;

    if (!token.trim()) {
      setError("Token required");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await resetPassword(token.trim(), password);
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "Reset failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <View style={s.cardWrap}>
            <View style={s.iconOk}>
              <Ionicons name="checkmark" size={36} color="#fff" />
            </View>
            <Text style={s.title}>Password reset</Text>
            <Text style={s.subtitle}>
              You can now log in with your new password.
            </Text>
            <TouchableOpacity
              style={s.primary}
              onPress={() => router.replace("/login")}
            >
              <Text style={s.primaryText}>Back to login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

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
              <Ionicons name="key-outline" size={48} color={c.accent} />
            </View>

            <Text style={s.title}>Reset password</Text>
            <Text style={s.subtitle}>
              Paste the token from your email and choose a new password.
            </Text>

            <Text style={s.label}>Reset token</Text>
            <TextInput
              style={s.input}
              value={token}
              onChangeText={(v) => {
                setToken(v);
                setError("");
              }}
              placeholder="Paste token here"
              placeholderTextColor={c.textFaint}
              autoCapitalize="none"
              editable={!submitting}
            />

            <Text style={s.label}>New password</Text>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                setError("");
              }}
              placeholder="Min 8 characters"
              placeholderTextColor={c.textFaint}
              secureTextEntry
              editable={!submitting}
            />

            <Text style={s.label}>Confirm new password</Text>
            <TextInput
              style={s.input}
              value={confirm}
              onChangeText={(v) => {
                setConfirm(v);
                setError("");
              }}
              placeholder="Re-enter password"
              placeholderTextColor={c.textFaint}
              secureTextEntry
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
                <Text style={s.primaryText}>Reset password</Text>
              )}
            </TouchableOpacity>
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
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 30,
    },
    cardWrap: {
      width: isDesktop ? 420 : ("100%" as DimensionValue),
      maxWidth: isDesktop ? 420 : undefined,
      backgroundColor: isDesktop ? c.surface : "transparent",
      borderRadius: isDesktop ? 20 : 0,
      borderWidth: isDesktop ? 1 : 0,
      borderColor: isDesktop ? c.surfaceBorder : "transparent",
      padding: isDesktop ? 32 : 0,
      alignItems: isDesktop ? "center" : undefined,
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
      alignSelf: "flex-start",
    },
    iconWrap: {
      width: isDesktop ? 88 : 80,
      height: isDesktop ? 88 : 80,
      borderRadius: isDesktop ? 44 : 40,
      backgroundColor: "rgba(37,99,235,0.12)",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: isDesktop ? 24 : 18,
    },
    iconOk: {
      width: isDesktop ? 88 : 80,
      height: isDesktop ? 88 : 80,
      borderRadius: isDesktop ? 44 : 40,
      backgroundColor: "#16a34a",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: isDesktop ? 24 : 18,
    },
    title: {
      color: c.text,
      fontSize: isDesktop ? 28 : 26,
      fontWeight: "800",
      marginBottom: isDesktop ? 12 : 10,
      textAlign: "center",
    },
    subtitle: {
      color: c.textMuted,
      fontSize: isDesktop ? 15 : 14,
      lineHeight: isDesktop ? 22 : 20,
      marginBottom: isDesktop ? 32 : 26,
      textAlign: "center",
    },
    label: {
      color: c.text,
      fontSize: isDesktop ? 14 : 13,
      fontWeight: "600",
      marginBottom: 8,
      marginTop: 14,
      alignSelf: "flex-start",
      width: "100%" as DimensionValue,
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
      width: "100%" as DimensionValue,
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
      marginTop: 14,
      alignSelf: "flex-start",
    },
    primary: {
      backgroundColor: c.accent,
      paddingVertical: isDesktop ? 16 : 15,
      borderRadius: isDesktop ? 12 : 14,
      alignItems: "center",
      marginTop: isDesktop ? 28 : 26,
      width: "100%" as DimensionValue,
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
  });
