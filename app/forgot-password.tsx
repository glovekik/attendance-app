import React, { useState } from "react";

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import { requestPasswordReset } from "../src/services/api";

export default function ForgotPassword() {

  const router = useRouter();

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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >

          <TouchableOpacity
            style={s.backBtn}
            onPress={() => router.back()}
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color="#fff"
            />
          </TouchableOpacity>

          <View style={s.iconWrap}>
            <Ionicons
              name="lock-closed-outline"
              size={48}
              color="#2563eb"
            />
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
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!submitting}
              />

              {error ? <Text style={s.err}>{error}</Text> : null}

              <TouchableOpacity
                style={[
                  s.primary,
                  submitting && { opacity: 0.7 },
                ]}
                onPress={submit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.primaryText}>
                    Send reset link
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {submitted && (
            <>
              <TouchableOpacity
                style={s.primary}
                onPress={() =>
                  router.push("/reset-password")
                }
              >
                <Text style={s.primaryText}>
                  I have a token
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.secondary}
                onPress={() => router.replace("/login")}
              >
                <Text style={s.secondaryText}>
                  Back to login
                </Text>
              </TouchableOpacity>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#020617" },
  content: { padding: 24, paddingTop: 60, flexGrow: 1 },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1f2937",
    marginBottom: 30,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(37,99,235,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 10,
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 26,
  },
  label: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 6,
  },
  input: {
    backgroundColor: "#0f172a",
    color: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
    fontSize: 15,
  },
  err: {
    color: "#fca5a5",
    fontSize: 13,
    marginTop: 8,
  },
  primary: {
    backgroundColor: "#2563eb",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 24,
  },
  primaryText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  secondary: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 12,
  },
  secondaryText: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "600",
  },
});
