import React, { useEffect, useRef, useState, useMemo } from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Platform,
  DimensionValue,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { useResponsive } from "../src/utils/responsive";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  loginUser,
  verifyOtp,
  resendOtp } from "../src/services/api";

import { registerPushToken } from "../src/services/notifications";
import { setSession } from "../src/services/session";

/**
 * Login screen — clean light theme. A soft light backdrop with two faint
 * pastel orbs gives the frosted-glass card something to sit on; the card
 * itself is a light "glass" panel (translucent white + blur) with dark
 * text and simple inputs. The OTP step is inlined (no modal) so users keep
 * context.
 */
export default function Login() {
  const router = useRouter();
  const responsive = useResponsive();
  const isDesktop = responsive.isDesktop;

  const styles = useMemo(() => makeStyles(isDesktop), [isDesktop]);

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

  // Card entrance: fade + gentle rise.
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardY = useRef(new Animated.Value(22)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardY, {
        toValue: 0,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [cardOpacity, cardY]);

  // Redirect if a token already exists.
  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem("token");
      if (token) router.replace("/");
    })();
  }, [router]);

  const completeLogin = async (token: string, refreshToken?: string) => {
    await setSession(token, refreshToken);
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
      await completeLogin(token, res.refresh_token);
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
      await completeLogin(token, res.refresh_token);
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

  return (
    <View style={styles.root}>
      {/* Soft light backdrop. */}
      <LinearGradient
        colors={["#EAF0FF", "#F5F8FF", "#FFFFFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Two faint pastel orbs so the frosted glass has something to blur. */}
      <View style={[styles.orb, styles.orbA]} />
      <View style={[styles.orb, styles.orbB]} />

      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={{ opacity: cardOpacity, transform: [{ translateY: cardY }] }}
            >
              <BlurView
                intensity={Platform.OS === "android" ? 20 : 30}
                tint="light"
                experimentalBlurMethod="dimezisBlurView"
                style={styles.card}
              >
                {/* Logo. */}
                <View style={styles.logoBadge}>
                  <Image
                    source={require("../assets/images/logo.jpg")}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                </View>

                <Text style={styles.title}>
                  {otpRequired ? "Verify your email" : "Welcome back"}
                </Text>
                <Text style={styles.subtitle}>
                  {otpRequired
                    ? `Enter the 6-digit code sent to ${email}.`
                    : "Sign in to your 4SightHub account"}
                </Text>

                <View style={styles.form}>
                  {!otpRequired ? (
                    <>
                      <FieldLabel label="Email address" isDesktop={isDesktop} />
                      <View
                        style={[
                          styles.inputWrap,
                          !!emailError && styles.inputErr,
                        ]}
                      >
                        <Ionicons name="mail-outline" size={18} color="#94A3B8" />
                        <TextInput
                          style={styles.input}
                          value={email}
                          onChangeText={setEmail}
                          placeholder="name@company.com"
                          placeholderTextColor="#9AA3B2"
                          autoCapitalize="none"
                          keyboardType="email-address"
                          autoComplete="email"
                        />
                      </View>
                      {!!emailError && (
                        <Text style={styles.fieldErr}>{emailError}</Text>
                      )}

                      <View style={styles.labelRow}>
                        <FieldLabel label="Password" compact isDesktop={isDesktop} />
                        <TouchableOpacity
                          onPress={() => router.push("/forgot-password")}
                          hitSlop={8}
                        >
                          <Text style={styles.linkText}>Forgot password?</Text>
                        </TouchableOpacity>
                      </View>
                      <View
                        style={[
                          styles.inputWrap,
                          !!passwordError && styles.inputErr,
                        ]}
                      >
                        <Ionicons
                          name="lock-closed-outline"
                          size={18}
                          color="#94A3B8"
                        />
                        <TextInput
                          style={styles.input}
                          value={password}
                          onChangeText={setPassword}
                          placeholder="Enter your password"
                          placeholderTextColor="#9AA3B2"
                          secureTextEntry={!showPassword}
                          autoCapitalize="none"
                          autoComplete="password"
                        />
                        <TouchableOpacity
                          onPress={() => setShowPassword((v) => !v)}
                          hitSlop={8}
                        >
                          <Ionicons
                            name={
                              showPassword ? "eye-off-outline" : "eye-outline"
                            }
                            size={20}
                            color="#94A3B8"
                          />
                        </TouchableOpacity>
                      </View>
                      {!!passwordError && (
                        <Text style={styles.fieldErr}>{passwordError}</Text>
                      )}

                      {!!serverError && (
                        <View style={styles.errorBanner}>
                          <Ionicons
                            name="alert-circle-outline"
                            size={16}
                            color="#DC2626"
                          />
                          <Text style={styles.errorBannerText}>
                            {serverError}
                          </Text>
                        </View>
                      )}

                      <TouchableOpacity
                        onPress={onSignIn}
                        disabled={loading}
                        activeOpacity={0.9}
                        style={[styles.ctaWrap, { opacity: loading ? 0.7 : 1 }]}
                      >
                        <LinearGradient
                          colors={["#2563EB", "#4F46E5"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.cta}
                        >
                          {loading ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <Text style={styles.ctaText}>Sign in</Text>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    </>
                  ) : (
                    // ===== OTP STEP =====
                    <>
                      <FieldLabel label="Verification code" isDesktop={isDesktop} />
                      <View style={styles.inputWrap}>
                        <TextInput
                          style={[styles.input, styles.otpInput]}
                          value={otpCode}
                          onChangeText={setOtpCode}
                          placeholder="000000"
                          placeholderTextColor="#C2C9D6"
                          keyboardType="number-pad"
                          maxLength={8}
                        />
                      </View>

                      <TouchableOpacity
                        onPress={onVerifyOtp}
                        disabled={otpVerifying}
                        activeOpacity={0.9}
                        style={[
                          styles.ctaWrap,
                          { opacity: otpVerifying ? 0.7 : 1 },
                        ]}
                      >
                        <LinearGradient
                          colors={["#2563EB", "#4F46E5"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.cta}
                        >
                          {otpVerifying ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <Text style={styles.ctaText}>Verify & sign in</Text>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>

                      <View style={styles.otpFooter}>
                        <TouchableOpacity
                          onPress={onResendOtp}
                          disabled={otpResending}
                        >
                          <Text style={styles.linkText}>
                            {otpResending ? "Resending…" : "Resend code"}
                          </Text>
                        </TouchableOpacity>
                        <Text style={styles.dot}>·</Text>
                        <TouchableOpacity
                          onPress={() => {
                            setOtpRequired(false);
                            setOtpCode("");
                          }}
                        >
                          <Text
                            style={[
                              styles.linkText,
                              { color: "#94A3B8" },
                            ]}
                          >
                            Use different email
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              </BlurView>
            </Animated.View>

            <Text style={styles.footnote}>
              By continuing you agree to our Terms and Privacy Policy.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function FieldLabel({
  label,
  compact,
  isDesktop,
}: {
  label: string;
  compact?: boolean;
  isDesktop?: boolean;
}) {
  return (
    <Text
      style={[
        baseStyles.fieldLabel,
        compact && { marginTop: 0 },
        isDesktop && { fontSize: 14 },
      ]}
    >
      {label}
    </Text>
  );
}

// Base styles that don't change with responsive
const baseStyles = StyleSheet.create({
  fieldLabel: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
});

const makeStyles = (isDesktop: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: "#F5F8FF" },
    safe: { flex: 1 },
    scroll: {
      flexGrow: 1,
      justifyContent: "center",
      alignItems: isDesktop ? "center" : undefined,
      paddingHorizontal: isDesktop ? 40 : 22,
      paddingVertical: isDesktop ? 60 : 40,
    },

    // Faint pastel orbs — low opacity so the page stays light and calm.
    orb: { position: "absolute", borderRadius: 999 },
    orbA: {
      width: isDesktop ? 380 : 260,
      height: isDesktop ? 380 : 260,
      backgroundColor: "#93C5FD",
      opacity: 0.22,
      top: isDesktop ? -90 : -60,
      left: isDesktop ? ("12%" as DimensionValue) : -70,
    },
    orbB: {
      width: isDesktop ? 320 : 230,
      height: isDesktop ? 320 : 230,
      backgroundColor: "#C4B5FD",
      opacity: 0.2,
      bottom: isDesktop ? 30 : 10,
      right: isDesktop ? ("16%" as DimensionValue) : -80,
    },

    // Light frosted-glass card.
    card: {
      borderRadius: isDesktop ? 24 : 26,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.9)",
      backgroundColor: "rgba(255,255,255,0.7)",
      paddingHorizontal: isDesktop ? 40 : 24,
      paddingTop: isDesktop ? 40 : 32,
      paddingBottom: isDesktop ? 36 : 30,
      width: isDesktop ? 440 : ("100%" as DimensionValue),
      maxWidth: isDesktop ? 440 : undefined,
      shadowColor: "#1E293B",
      shadowOpacity: 0.12,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 14 },
      elevation: 6,
      ...(Platform.OS === "web"
        ? {
            boxShadow: "0 20px 45px -15px rgba(30, 41, 59, 0.25)",
          }
        : {}),
    },

    logoBadge: {
      alignSelf: "center",
      backgroundColor: "#fff",
      borderRadius: isDesktop ? 16 : 14,
      paddingHorizontal: isDesktop ? 24 : 18,
      paddingVertical: isDesktop ? 14 : 11,
      marginBottom: isDesktop ? 28 : 22,
      borderWidth: 1,
      borderColor: "#EEF2F7",
      shadowColor: "#1E293B",
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    logo: {
      width: isDesktop ? 180 : 150,
      height: isDesktop ? 50 : 42,
    },

    title: {
      color: "#0F172A",
      fontSize: isDesktop ? 28 : 24,
      fontWeight: "800",
      letterSpacing: -0.3,
      textAlign: "center",
      marginBottom: isDesktop ? 8 : 6,
    },
    subtitle: {
      color: "#64748B",
      fontSize: isDesktop ? 15 : 13.5,
      lineHeight: isDesktop ? 22 : 19,
      textAlign: "center",
      marginBottom: isDesktop ? 28 : 22,
    },

    form: { width: "100%" as DimensionValue },
    labelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 16,
      marginBottom: 8,
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: isDesktop ? 12 : 14,
      borderWidth: 1,
      borderColor: "#E2E8F0",
      backgroundColor: "#FFFFFF",
      paddingHorizontal: isDesktop ? 16 : 14,
      minHeight: isDesktop ? 52 : 50,
      ...(Platform.OS === "web"
        ? {
            transition: "border-color 0.15s ease, background-color 0.15s ease",
          }
        : {}),
    },
    inputErr: { borderColor: "#F87171" },
    input: {
      flex: 1,
      fontSize: isDesktop ? 16 : 15,
      color: "#0F172A",
      paddingVertical: isDesktop ? 14 : 12,
      ...(Platform.OS === "web"
        ? ({
            outlineStyle: "none",
          } as any)
        : {}),
    },
    otpInput: {
      letterSpacing: isDesktop ? 8 : 6,
      fontSize: isDesktop ? 24 : 20,
      fontWeight: "700",
      textAlign: "center",
    },
    fieldErr: {
      color: "#DC2626",
      fontSize: 12,
      marginTop: 6,
      marginLeft: 2,
    },
    linkText: {
      color: "#2563EB",
      fontSize: isDesktop ? 14 : 13,
      fontWeight: "600",
      ...(Platform.OS === "web"
        ? {
            cursor: "pointer",
            transition: "opacity 0.15s ease",
          }
        : {}),
    },
    errorBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: isDesktop ? 14 : 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(220,38,38,0.25)",
      backgroundColor: "rgba(254,226,226,0.7)",
      marginTop: 16,
    },
    errorBannerText: {
      color: "#B91C1C",
      fontSize: isDesktop ? 14 : 13,
      fontWeight: "500",
      flex: 1,
    },
    ctaWrap: {
      borderRadius: isDesktop ? 12 : 14,
      overflow: "hidden",
      marginTop: isDesktop ? 28 : 24,
      ...(Platform.OS === "web"
        ? {
            cursor: "pointer",
            transition: "transform 0.15s ease, opacity 0.15s ease",
          }
        : {}),
    },
    cta: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: isDesktop ? 16 : 15,
    },
    ctaText: {
      color: "#fff",
      fontSize: isDesktop ? 16 : 15,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    otpFooter: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 10,
      marginTop: isDesktop ? 28 : 22,
    },
    dot: { color: "#CBD5E1", fontSize: 16 },
    footnote: {
      color: "#94A3B8",
      fontSize: isDesktop ? 13 : 12,
      textAlign: "center",
      marginTop: isDesktop ? 28 : 22,
      lineHeight: isDesktop ? 18 : 16,
      maxWidth: isDesktop ? 440 : undefined,
    },
  });
