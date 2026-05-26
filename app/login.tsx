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
          showsVerticalScrollIndicator={false}
        >
          {/* ===== BRAND BANNER ===== */}
          <View style={[styles.banner, { backgroundColor: c.accentSoft }]}>
            {/* decorative blobs */}
            <View
              style={[
                styles.blob,
                styles.blobOne,
                { backgroundColor: c.accent, opacity: 0.12 },
              ]}
            />
            <View
              style={[
                styles.blob,
                styles.blobTwo,
                { backgroundColor: c.accent, opacity: 0.08 },
              ]}
            />
            <Image
              source={require("../assets/images/logo.jpg")}
              style={styles.bannerLogo}
              resizeMode="contain"
            />
            <Text style={[styles.bannerTagline, { color: c.accentText }]}>
              AI Ambitions Empowered
            </Text>
          </View>

          {/* ===== SIGN-IN CARD ===== */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: c.surface,
                borderColor: c.surfaceBorder,
                shadowColor: c.shadow },
            ]}
          >
            {/* contextual icon ring */}
            <View
              style={[
                styles.cardIconRing,
                { backgroundColor: c.pastelLavender },
              ]}
            >
              <Ionicons
                name={otpRequired ? "mail-outline" : "lock-closed-outline"}
                size={26}
                color={c.accent}
              />
            </View>

            <Text style={[styles.cardTitle, { color: c.text }]}>
              {otpRequired ? "Check your email" : "Welcome back"}
            </Text>
            <Text style={[styles.cardSub, { color: c.textMuted }]}>
              {otpRequired
                ? `We sent a 6-digit code to ${email}.`
                : "Sign in to continue to your workspace."}
            </Text>

          {/* ===== FORM ===== */}
          {!otpRequired ? (
            <View style={{ marginTop: 6 }}>
              <FieldLabel label="EMAIL" theme={theme} />
              <View
                style={[
                  styles.inputWrap,
                  {
                    backgroundColor: c.surface,
                    borderColor: emailError ? c.dangerText : c.surfaceBorder },
                ]}
              >
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={c.textMuted}
                />
                <TextInput
                  style={[styles.input, { color: c.text }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@company.com"
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

              <FieldLabel label="PASSWORD" theme={theme} />
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
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={c.textMuted}
                />
                <TextInput
                  style={[styles.input, { color: c.text }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Your password"
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

              <TouchableOpacity
                onPress={() => router.push("/forgot-password")}
                style={{ alignSelf: "flex-end", marginTop: 10 }}
              >
                <Text style={[styles.linkText, { color: c.accent }]}>
                  Forgot password?
                </Text>
              </TouchableOpacity>

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
                    style={[styles.errorBannerText, { color: c.dangerText }]}
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
                    shadowColor: c.shadow,
                    opacity: loading ? 0.7 : 1 },
                ]}
                onPress={onSignIn}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.ctaText}>Sign in</Text>
                    <Ionicons
                      name="arrow-forward"
                      size={18}
                      color="#fff"
                    />
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            // ===== OTP STEP =====
            <View style={{ marginTop: 22 }}>
              <FieldLabel label="VERIFICATION CODE" theme={theme} />
              <View
                style={[
                  styles.inputWrap,
                  {
                    backgroundColor: c.surface,
                    borderColor: c.surfaceBorder },
                ]}
              >
                <Ionicons
                  name="keypad-outline"
                  size={18}
                  color={c.textMuted}
                />
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: c.text,
                      letterSpacing: 4,
                      textAlign: "center" },
                  ]}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  placeholder="••••••"
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
                    shadowColor: c.shadow,
                    opacity: otpVerifying ? 0.7 : 1,
                    marginTop: 18 },
                ]}
                onPress={onVerifyOtp}
                disabled={otpVerifying}
                activeOpacity={0.85}
              >
                {otpVerifying ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.ctaText}>Verify & sign in</Text>
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
            </View>
          )}
          </View>
          {/* /sign-in card */}

          <Text style={[styles.footnote, { color: c.textFaint }]}>
            By signing in you accept our policy and terms.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const FieldLabel = ({ label, theme }: { label: string; theme: any }) => (
  <Text
    style={{
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.4,
      marginTop: 16,
      marginBottom: 6 }}
  >
    {label}
  </Text>
);


const makeStyles = (c: any) => StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    paddingBottom: 40 },

  // ===== BRAND BANNER =====
  banner: {
    paddingTop: 36,
    paddingBottom: 80,
    paddingHorizontal: 24,
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32 },
  blob: {
    position: "absolute",
    borderRadius: 999 },
  blobOne: {
    width: 220,
    height: 220,
    top: -70,
    right: -60 },
  blobTwo: {
    width: 160,
    height: 160,
    bottom: -40,
    left: -50 },
  bannerLogo: {
    width: "100%",
    maxWidth: 260,
    height: 78 },
  bannerTagline: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 12,
    textTransform: "uppercase" },

  // ===== CARD =====
  card: {
    marginHorizontal: 20,
    marginTop: -56,
    padding: 24,
    paddingTop: 30,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "stretch",
    shadowOpacity: 1,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8 },
  cardIconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    alignSelf: "center" },
  cardTitle: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 4 },
  cardSub: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 4 },

  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    minHeight: 52,
    gap: 10 },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12 },
  fieldErr: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4 },
  linkText: {
    fontSize: 13,
    fontWeight: "700" },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14 },
  errorBannerText: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 22,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4 },
  ctaText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3 },
  otpFooter: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 20 },
  dot: { fontSize: 16 },
  footnote: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 24,
    paddingHorizontal: 32 } });
