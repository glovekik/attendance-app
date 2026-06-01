import React, { useEffect, useState, useMemo} from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  loginUser,
  verifyOtp,
  resendOtp } from "../src/services/api";

import { registerPushToken } from "../src/services/notifications";
import { useTheme } from "../src/theme/ThemeProvider";

/**
 * Login screen — branded hero with the 4SightAI logo on a soft accent
 * banner, a floating sign-in card overlapping the banner, and the OTP
 * step inlined (no modal) so users keep visual context.
 */
export default function Login() {
  const router = useRouter();
  const { theme } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [serverError, setServerError] = useState("");

  // OTP step state
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpResending, setOtpResending] = useState(false);

  // Redirect if a token already exists.
  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem("token");
      if (token) router.replace("/");
    })();
  }, [router]);

  const completeLogin = async (token: string) => {
    await AsyncStorage.setItem("token", token);
    registerPushToken(token).catch(() => {});
    router.replace("/");
  };

  const validate = (): boolean => {
    setEmailError("");
    setPasswordError("");
    setServerError("");
    let ok = true;
    if (!email.trim()) {
      setEmailError("Email is required");
      ok = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Enter a valid email");
      ok = false;
    }
    if (!password.trim()) {
      setPasswordError("Password is required");
      ok = false;
    } else if (password.length < 6) {
      setPasswordError("Minimum 6 characters");
      ok = false;
    }
    return ok;
  };

  const onSignIn = async () => {
    if (loading || !validate()) return;
    try {
      setLoading(true);
      setServerError("");
      const res = await loginUser({ email, password });
      if (res.step === "OTP_REQUIRED") {
        setOtpRequired(true);
        setOtpCode("");
        return;
      }
      const token = res.access_token || res.token;
      if (!token) {
        setServerError("Invalid credentials");
        return;
      }
      await completeLogin(token);
    } catch (err: any) {
      setServerError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const onVerifyOtp = async () => {
    if (otpVerifying) return;
    if (otpCode.trim().length < 4) {
      Alert.alert("Enter the code from your email");
      return;
    }
    try {
      setOtpVerifying(true);
      const res = await verifyOtp(email, otpCode.trim());
      const token = res.access_token;
      if (!token) {
        Alert.alert("OTP failed", "No token returned");
        return;
      }
      setOtpRequired(false);
      setOtpCode("");
      await completeLogin(token);
    } catch (err: any) {
      Alert.alert("Invalid OTP", err?.message || "");
    } finally {
      setOtpVerifying(false);
    }
  };

  const onResendOtp = async () => {
    if (otpResending) return;
    setOtpResending(true);
    try {
      await resendOtp(email);
      Alert.alert("Sent", "A new OTP has been emailed.");
    } catch (err: any) {
      Alert.alert("Resend failed", err?.message || "");
    } finally {
      setOtpResending(false);
    }
  };

  const c = theme.colors;

  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo — modest, top-aligned, no decoration. Same convention
              as Microsoft 365 / Google Workspace / Stripe Dashboard. */}
          <Image
            source={require("../assets/images/logo.jpg")}
            style={styles.logo}
            resizeMode="contain"
          />

          {/* Header — left-aligned with clear hierarchy. */}
          <Text style={[styles.title, { color: c.text }]}>
            {otpRequired ? "Verify your email" : "Sign in"}
          </Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>
            {otpRequired
              ? `Enter the 6-digit code sent to ${email}.`
              : "Use your work account to continue."}
          </Text>

          {/* Form */}
          <View style={styles.form}>
            {!otpRequired ? (
              <>
                <FieldLabel label="Email address" theme={theme} />
                <View
                  style={[
                    styles.inputWrap,
                    {
                      backgroundColor: c.surface,
                      borderColor: emailError
                        ? c.dangerText
                        : c.surfaceBorder },
                  ]}
                >
                  <TextInput
                    style={[styles.input, { color: c.text }]}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="name@company.com"
                    placeholderTextColor={c.textFaint}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                  />
                </View>
                {!!emailError && (
                  <Text style={[styles.fieldErr, { color: c.dangerText }]}>
                    {emailError}
                  </Text>
                )}

                <View style={styles.labelRow}>
                  <FieldLabel label="Password" theme={theme} compact />
                  <TouchableOpacity
                    onPress={() => router.push("/forgot-password")}
                    hitSlop={8}
                  >
                    <Text style={[styles.linkText, { color: c.accent }]}>
                      Forgot password?
                    </Text>
                  </TouchableOpacity>
                </View>
                <View
                  style={[
                    styles.inputWrap,
                    {
                      backgroundColor: c.surface,
                      borderColor: passwordError
                        ? c.dangerText
                        : c.surfaceBorder },
                  ]}
                >
                  <TextInput
                    style={[styles.input, { color: c.text }]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter your password"
                    placeholderTextColor={c.textFaint}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="password"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color={c.textMuted}
                    />
                  </TouchableOpacity>
                </View>
                {!!passwordError && (
                  <Text style={[styles.fieldErr, { color: c.dangerText }]}>
                    {passwordError}
                  </Text>
                )}

                {!!serverError && (
                  <View
                    style={[
                      styles.errorBanner,
                      {
                        backgroundColor: c.dangerBg,
                        borderColor: c.dangerText },
                    ]}
                  >
                    <Ionicons
                      name="alert-circle-outline"
                      size={16}
                      color={c.dangerText}
                    />
                    <Text
                      style={[
                        styles.errorBannerText,
                        { color: c.dangerText },
                      ]}
                    >
                      {serverError}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.cta,
                    {
                      backgroundColor: c.accent,
                      opacity: loading ? 0.7 : 1 },
                  ]}
                  onPress={onSignIn}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color={c.textInverse} />
                  ) : (
                    <Text
                      style={[styles.ctaText, { color: c.textInverse }]}
                    >
                      Sign in
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              // ===== OTP STEP =====
              <>
                <FieldLabel label="Verification code" theme={theme} />
                <View
                  style={[
                    styles.inputWrap,
                    {
                      backgroundColor: c.surface,
                      borderColor: c.surfaceBorder },
                  ]}
                >
                  <TextInput
                    style={[
                      styles.input,
                      {
                        color: c.text,
                        letterSpacing: 6,
                        fontSize: 20,
                        fontWeight: "700",
                        textAlign: "center" },
                    ]}
                    value={otpCode}
                    onChangeText={setOtpCode}
                    placeholder="000000"
                    placeholderTextColor={c.textFaint}
                    keyboardType="number-pad"
                    maxLength={8}
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.cta,
                    {
                      backgroundColor: c.accent,
                      opacity: otpVerifying ? 0.7 : 1 },
                  ]}
                  onPress={onVerifyOtp}
                  disabled={otpVerifying}
                  activeOpacity={0.85}
                >
                  {otpVerifying ? (
                    <ActivityIndicator color={c.textInverse} />
                  ) : (
                    <Text
                      style={[styles.ctaText, { color: c.textInverse }]}
                    >
                      Verify & sign in
                    </Text>
                  )}
                </TouchableOpacity>

                <View style={styles.otpFooter}>
                  <TouchableOpacity
                    onPress={onResendOtp}
                    disabled={otpResending}
                  >
                    <Text style={[styles.linkText, { color: c.accent }]}>
                      {otpResending ? "Resending…" : "Resend code"}
                    </Text>
                  </TouchableOpacity>
                  <Text style={[styles.dot, { color: c.textFaint }]}>·</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setOtpRequired(false);
                      setOtpCode("");
                    }}
                  >
                    <Text style={[styles.linkText, { color: c.textMuted }]}>
                      Use different email
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          <Text style={[styles.footnote, { color: c.textFaint }]}>
            By continuing you agree to our Terms and Privacy Policy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const FieldLabel = ({
  label,
  theme,
  compact }: {
  label: string;
  theme: any;
  compact?: boolean;
}) => (
  <Text
    style={{
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: "600",
      marginTop: compact ? 0 : 18,
      marginBottom: 6 }}
  >
    {label}
  </Text>
);


const makeStyles = (c: any) => StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 48,
    paddingBottom: 28 },

  logo: {
    width: 140,
    height: 44,
    alignSelf: "flex-start",
    marginBottom: 40 },

  title: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.4,
    marginBottom: 6 },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 28 },

  form: { width: "100%" },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 6 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 46 },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10 },
  fieldErr: {
    fontSize: 12,
    marginTop: 6,
    marginLeft: 2 },
  linkText: {
    fontSize: 13,
    fontWeight: "600" },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 18 },
  errorBannerText: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1 },
  cta: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 24 },
  ctaText: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.2 },
  otpFooter: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginTop: 22 },
  dot: { fontSize: 16 },
  footnote: {
    fontSize: 12,
    marginTop: 28,
    lineHeight: 16 } });
