import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  StatusBar,
  SafeAreaView,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Alert,
} from "react-native";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  loginUser,
  verifyOtp,
  resendOtp,
} from "../src/services/api";

import { registerPushToken } from "../src/services/notifications";

const { width, height } =
  Dimensions.get("window");

const isSmallDevice =
  height < 700;

const PRIMARY = "#2563EB";

export default function Login() {

  const router = useRouter();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [showPassword, setShowPassword] =
    useState(false);

  const [emailError, setEmailError] =
    useState("");

  const [passwordError, setPasswordError] =
    useState("");

  const [serverError, setServerError] =
    useState("");

  // OTP flow state (only used when REQUIRE_LOGIN_OTP=true on backend)
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpResending, setOtpResending] = useState(false);

  const completeLogin = async (token: string) => {
    await AsyncStorage.setItem("token", token);
    registerPushToken(token).catch(() => {});
    router.replace("/");
  };

  const onVerifyOtp = async () => {
    if (otpVerifying) return;
    if (otpCode.trim().length < 4) {
      Alert.alert("Enter the 6-digit code from your email");
      return;
    }
    setOtpVerifying(true);
    try {
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

  // Animated values
  const glow1 = useRef(
    new Animated.Value(0)
  ).current;

  const glow2 = useRef(
    new Animated.Value(0)
  ).current;

  // Animation refs
  const glow1Loop = useRef<any>(null);

  const glow2Loop = useRef<any>(null);

  useEffect(() => {

    checkSession();

    startAnimations();

    return () => {

      glow1.stopAnimation();

      glow2.stopAnimation();

      glow1Loop.current?.stop();

      glow2Loop.current?.stop();
    };

  }, []);

  // ================= SESSION CHECK =================
  const checkSession = async () => {

    try {

      const token =
        await AsyncStorage.getItem(
          "token"
        );

      if (token) {

        router.replace("/");
      }

    } catch (err) {

      console.log(err);
    }
  };

  // ================= BACKGROUND ANIMATION =================
  const startAnimations = () => {

    glow1Loop.current = Animated.loop(

      Animated.sequence([

        Animated.timing(glow1, {

          toValue: 1,

          duration: 4000,

          easing:
            Easing.inOut(
              Easing.ease
            ),

          useNativeDriver: true,
        }),

        Animated.timing(glow1, {

          toValue: 0,

          duration: 4000,

          easing:
            Easing.inOut(
              Easing.ease
            ),

          useNativeDriver: true,
        }),
      ])
    );

    glow2Loop.current = Animated.loop(

      Animated.sequence([

        Animated.timing(glow2, {

          toValue: 1,

          duration: 5000,

          easing:
            Easing.inOut(
              Easing.ease
            ),

          useNativeDriver: true,
        }),

        Animated.timing(glow2, {

          toValue: 0,

          duration: 5000,

          easing:
            Easing.inOut(
              Easing.ease
            ),

          useNativeDriver: true,
        }),
      ])
    );

    glow1Loop.current.start();

    glow2Loop.current.start();
  };

  // ================= VALIDATION =================
  const validateInputs = () => {

    let valid = true;

    setEmailError("");

    setPasswordError("");

    setServerError("");

    if (!email.trim()) {

      setEmailError(
        "Email is required"
      );

      valid = false;

    } else {

      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (
        !emailRegex.test(email)
      ) {

        setEmailError(
          "Enter valid email"
        );

        valid = false;
      }
    }

    if (!password.trim()) {

      setPasswordError(
        "Password is required"
      );

      valid = false;

    } else if (
      password.length < 6
    ) {

      setPasswordError(
        "Minimum 6 characters"
      );

      valid = false;
    }

    return valid;
  };

  // ================= LOGIN =================
  const handleLogin =
    async () => {

      if (loading) return;

      const valid =
        validateInputs();

      if (!valid) return;

      try {

        setLoading(true);

        setServerError("");

        const res =
          await loginUser({

            email,

            password,
          });

        // OTP gate: backend may require an emailed OTP before issuing the token
        if (res.step === "OTP_REQUIRED") {
          setOtpRequired(true);
          setOtpCode("");
          return;
        }

        const token =

          res.access_token ||

          res.token;

        if (!token) {

          setServerError(
            "Invalid credentials"
          );

          return;
        }

        await completeLogin(token);

      } catch (err: any) {

        console.log(err);

        setServerError(

          err?.message ||

          "Login failed"
        );

      } finally {

        setLoading(false);
      }
    };

  // ================= ANIMATION STYLES =================
  const glow1Style = {

    transform: [

      {
        translateY:
          glow1.interpolate({

            inputRange: [0, 1],

            outputRange: [0, 30],
          }),
      },

      {
        translateX:
          glow1.interpolate({

            inputRange: [0, 1],

            outputRange: [0, -20],
          }),
      },

      {
        scale:
          glow1.interpolate({

            inputRange: [0, 1],

            outputRange: [1, 1.1],
          }),
      },
    ],
  };

  const glow2Style = {

    transform: [

      {
        translateY:
          glow2.interpolate({

            inputRange: [0, 1],

            outputRange: [0, -25],
          }),
      },

      {
        translateX:
          glow2.interpolate({

            inputRange: [0, 1],

            outputRange: [0, 20],
          }),
      },

      {
        scale:
          glow2.interpolate({

            inputRange: [0, 1],

            outputRange: [1, 1.15],
          }),
      },
    ],
  };

  return (

    <SafeAreaView style={styles.safe}>

      <StatusBar
        barStyle="light-content"
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >

        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={
            false
          }
        >

          <View style={styles.container}>

            {/* Animated Background */}
            <Animated.View
              style={[
                styles.topGlow,
                glow1Style,
              ]}
            />

            <Animated.View
              style={[
                styles.bottomGlow,
                glow2Style,
              ]}
            />

            {/* HEADER */}
            <View style={styles.header}>

              <Image
                source={{
                  uri:
                    "https://4sightai.com/images/logo-final.png",
                }}
                style={styles.logo}
                resizeMode="contain"
              />

              <Text style={styles.title}>
                Welcome Back
              </Text>

              <Text style={styles.subtitle}>
                Login to continue managing attendance
              </Text>

            </View>

            {/* CARD */}
            <View style={styles.card}>

              {/* EMAIL */}
              <Text style={styles.label}>
                Email Address
              </Text>

              <TextInput
                value={email}
                onChangeText={(text) => {

                  setEmail(text);

                  setEmailError("");
                }}
                placeholder="Enter email"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
                style={[

                  styles.input,

                  emailError &&
                    styles.inputError,
                ]}
              />

              {!!emailError && (

                <Text style={styles.errorText}>
                  {emailError}
                </Text>

              )}

              {/* PASSWORD */}
              <Text style={styles.label}>
                Password
              </Text>

              <View
                style={[

                  styles.passwordContainer,

                  passwordError &&
                    styles.inputError,
                ]}
              >

                <TextInput
                  value={password}
                  onChangeText={(text) => {

                    setPassword(text);

                    setPasswordError("");
                  }}
                  placeholder="Enter password"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={
                    !showPassword
                  }
                  style={
                    styles.passwordInput
                  }
                />

                <TouchableOpacity
                  onPress={() =>
                    setShowPassword(
                      !showPassword
                    )
                  }
                >

                  <Ionicons
                    name={
                      showPassword
                        ? "eye-off"
                        : "eye"
                    }
                    size={22}
                    color="#94a3b8"
                  />

                </TouchableOpacity>

              </View>

              {!!passwordError && (

                <Text style={styles.errorText}>
                  {passwordError}
                </Text>

              )}

              {/* SERVER ERROR */}
              {!!serverError && (

                <View
                  style={
                    styles.serverErrorBox
                  }
                >

                  <Text
                    style={
                      styles.serverErrorText
                    }
                  >
                    {serverError}
                  </Text>

                </View>

              )}

              {/* LOGIN BUTTON */}
              <TouchableOpacity
                activeOpacity={0.85}
                style={[

                  styles.btn,

                  loading &&
                    styles.btnDisabled,
                ]}
                onPress={
                  handleLogin
                }
                disabled={loading}
              >

                {loading ? (

                  <View
                    style={
                      styles.loadingRow
                    }
                  >

                    <ActivityIndicator
                      color="#fff"
                      size="small"
                    />

                    <Text
                      style={
                        styles.btnText
                      }
                    >
                      Logging in...
                    </Text>

                  </View>

                ) : (

                  <Text
                    style={
                      styles.btnText
                    }
                  >
                    Login
                  </Text>

                )}

              </TouchableOpacity>

              <TouchableOpacity
                style={styles.forgotBtn}
                onPress={() =>
                  router.push("/forgot-password")
                }
              >
                <Text style={styles.forgotText}>
                  Forgot password?
                </Text>
              </TouchableOpacity>

            </View>

          </View>

        </ScrollView>

      </KeyboardAvoidingView>

      {/* OTP MODAL — only shown when backend has REQUIRE_LOGIN_OTP=true */}
      <Modal
        visible={otpRequired}
        animationType="slide"
        transparent
        onRequestClose={() => setOtpRequired(false)}
      >
        <View style={styles.otpWrap}>
          <View style={styles.otpModal}>
            <View style={styles.otpHeader}>
              <Ionicons
                name="mail-outline"
                size={22}
                color="#3b82f6"
              />
              <Text style={styles.otpTitle}>Enter OTP</Text>
            </View>
            <Text style={styles.otpSub}>
              We emailed a 6-digit code to {email}. It expires in
              10 minutes.
            </Text>

            <TextInput
              style={styles.otpInput}
              value={otpCode}
              onChangeText={setOtpCode}
              placeholder="••••••"
              placeholderTextColor="#475569"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />

            <TouchableOpacity
              style={[
                styles.otpBtn,
                otpVerifying && { opacity: 0.7 },
              ]}
              onPress={onVerifyOtp}
              disabled={otpVerifying}
            >
              {otpVerifying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.otpBtnText}>Verify</Text>
              )}
            </TouchableOpacity>

            <View style={styles.otpFooter}>
              <TouchableOpacity
                onPress={onResendOtp}
                disabled={otpResending}
              >
                <Text style={styles.otpResend}>
                  {otpResending ? "Sending…" : "Resend code"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setOtpRequired(false);
                  setOtpCode("");
                }}
              >
                <Text style={styles.otpCancel}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({

  safe: {
    flex: 1,
    backgroundColor: "#020617",
  },

  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal:
      width * 0.06,
    paddingVertical: 24,
    backgroundColor: "#020617",
    overflow: "hidden",
  },

  topGlow: {
    position: "absolute",
    top: -120,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 280,
    backgroundColor: "#2563eb33",
  },

  bottomGlow: {
    position: "absolute",
    bottom: -100,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 260,
    backgroundColor: "#06b6d433",
  },

  header: {
    alignItems: "center",
    marginBottom: 36,
  },

  logo: {
    width: width * 0.5,
    height: 80,
    marginBottom: 20,
  },

  title: {
    color: "#fff",
    fontSize:
      isSmallDevice
        ? 26
        : 32,
    fontWeight: "800",
    marginBottom: 8,
  },

  subtitle: {
    color: "#94a3b8",
    fontSize:
      isSmallDevice
        ? 13
        : 15,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 10,
  },

  card: {
    backgroundColor:
      "rgba(15,23,42,0.92)",

    borderWidth: 1,

    borderColor:
      "rgba(255,255,255,0.08)",

    padding:
      isSmallDevice
        ? 18
        : 24,

    borderRadius: 24,

    width: "100%",

    maxWidth: 450,

    alignSelf: "center",

    shadowColor: "#000",

    shadowOpacity: 0.35,

    shadowRadius: 20,

    shadowOffset: {
      width: 0,
      height: 10,
    },

    elevation: 12,
  },

  label: {
    color: "#cbd5e1",
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "600",
  },

  input: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    color: "#fff",
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    fontSize: 15,
    marginBottom: 6,
  },

  passwordContainer: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  passwordInput: {
    flex: 1,
    color: "#fff",
    paddingVertical: 16,
    fontSize: 15,
  },

  inputError: {
    borderColor: "#ef4444",
  },

  errorText: {
    color: "#ef4444",
    fontSize: 13,
    marginBottom: 14,
    marginLeft: 4,
  },

  serverErrorBox: {
    backgroundColor:
      "rgba(239,68,68,0.12)",

    borderColor:
      "rgba(239,68,68,0.35)",

    borderWidth: 1,

    padding: 12,

    borderRadius: 12,

    marginBottom: 18,
  },

  serverErrorText: {
    color: "#fca5a5",
    fontSize: 13,
    textAlign: "center",
  },

  btn: {
    backgroundColor: PRIMARY,
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,

    shadowColor: PRIMARY,
    shadowOpacity: 0.45,
    shadowRadius: 12,

    shadowOffset: {
      width: 0,
      height: 6,
    },

    elevation: 8,
  },

  btnDisabled: {
    opacity: 0.7,
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  forgotBtn: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 8,
  },

  forgotText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
  },

  otpWrap: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  otpModal: {
    backgroundColor: "#0f172a",
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1e293b",
  },

  otpHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },

  otpTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },

  otpSub: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 18,
  },

  otpInput: {
    backgroundColor: "#111827",
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 12,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    marginBottom: 14,
  },

  otpBtn: {
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },

  otpBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },

  otpFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },

  otpResend: { color: "#3b82f6", fontSize: 13, fontWeight: "700" },
  otpCancel: { color: "#94a3b8", fontSize: 13, fontWeight: "700" },

});