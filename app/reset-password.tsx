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

import {
  useRouter,
  useLocalSearchParams,
} from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import { resetPassword } from "../src/services/api";

export default function ResetPassword() {

  const router = useRouter();
  const params = useLocalSearchParams();

  const [token, setToken] = useState(
    (params.token as string) || ""
  );
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
          <View style={s.iconOk}>
            <Ionicons
              name="checkmark"
              size={36}
              color="#fff"
            />
          </View>
          <Text style={s.title}>Password reset</Text>
          <Text style={s.subtitle}>
            You can now log in with your new password.
          </Text>
          <TouchableOpacity
            style={s.primary}
            onPress={() => router.replace("/login")}
          >
            <Text style={s.primaryText}>
              Back to login
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
              name="key-outline"
              size={48}
              color="#2563eb"
            />
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
            placeholderTextColor="#64748b"
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
            placeholderTextColor="#64748b"
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
            placeholderTextColor="#64748b"
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

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#020617" },
  content: { padding: 24, paddingTop: 60, flexGrow: 1 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
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
  iconOk: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#16a34a",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 26,
    textAlign: "center",
  },
  label: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 14,
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
    marginTop: 14,
  },
  primary: {
    backgroundColor: "#2563eb",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 26,
    width: "100%",
  },
  primaryText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
