import { useEffect, useRef } from "react";

import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/**
 * Clean light splash that plays over the native splash:
 *  - a soft light backdrop (matches the login screen),
 *  - the logo fades + scales + lifts into place,
 *  - a thin gradient accent line sweeps in beneath it,
 *  - the company name fades in,
 *  - then the whole layer fades up to reveal the app.
 *
 * Built on RN's Animated (native driver) + expo-linear-gradient.
 */

const COMPANY = "ForesightAI Technologies";

export function AnimatedSplash({ onFinish }: { onFinish: () => void }) {
  const layerOpacity = useRef(new Animated.Value(1)).current;
  const layerScale = useRef(new Animated.Value(1)).current;

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.92)).current;
  const logoY = useRef(new Animated.Value(14)).current;

  const lineScale = useRef(new Animated.Value(0)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered entrance: logo → accent line → company name.
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 7,
          tension: 45,
          useNativeDriver: true,
        }),
        Animated.timing(logoY, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(lineScale, {
        toValue: 1,
        duration: 800,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(footerOpacity, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    // Hold, then ease the whole layer out.
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(layerOpacity, {
          toValue: 0,
          duration: 500,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(layerScale, {
          toValue: 1.04,
          duration: 500,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) onFinish();
      });
    }, 2100);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { opacity: layerOpacity, transform: [{ scale: layerScale }] },
      ]}
      pointerEvents="none"
    >
      {/* Soft light backdrop — matches the login screen. */}
      <LinearGradient
        colors={["#EAF0FF", "#F5F8FF", "#FFFFFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.center}>
        {/* Logo. */}
        <Animated.View
          style={[
            styles.logoCard,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }, { translateY: logoY }],
            },
          ]}
        >
          <Image
            source={require("../../assets/images/logo.jpg")}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Accent "loading" line. */}
        <View style={styles.lineTrack}>
          <Animated.View
            style={[styles.lineFill, { transform: [{ scaleX: lineScale }] }]}
          >
            <LinearGradient
              colors={["#2563EB", "#4F46E5"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>

        {/* Company name. */}
        <Animated.Text style={[styles.footer, { opacity: footerOpacity }]}>
          {COMPANY}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  logoCard: {
    backgroundColor: "#fff",
    paddingHorizontal: 30,
    paddingVertical: 24,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#EEF2F7",
    shadowColor: "#1E293B",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  logo: {
    width: 230,
    height: 70,
  },
  lineTrack: {
    width: 150,
    height: 3,
    borderRadius: 2,
    marginTop: 30,
    backgroundColor: "rgba(37,99,235,0.14)",
    overflow: "hidden",
  },
  lineFill: {
    ...StyleSheet.absoluteFillObject,
    transformOrigin: "left",
  },
  footer: {
    marginTop: 18,
    color: "#64748B",
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: "600",
    textTransform: "uppercase",
  },
});
