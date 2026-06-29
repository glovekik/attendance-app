import { useEffect, useRef } from "react";

import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/**
 * Corporate-grade animated splash that plays over the native splash:
 *  - a deep navy -> indigo -> violet gradient that slowly drifts,
 *  - faint particles rising for subtle depth,
 *  - a soft glow that breathes behind the logo,
 *  - the logo badge fades + scales + lifts into place,
 *  - a thin gradient "loading" accent line sweeps in beneath it,
 *  - the company name fades in,
 *  - then the whole layer fades + eases up to reveal the app.
 *
 * Built on RN's Animated (native driver) + expo-linear-gradient — no
 * Reanimated/worklets setup needed.
 */

const COMPANY = "ForesightAI Technologies";

const PARTICLES = [
  { left: "16%", size: 6, delay: 0, duration: 5200 },
  { left: "80%", size: 4, delay: 900, duration: 6000 },
  { left: "34%", size: 5, delay: 1700, duration: 4800 },
  { left: "66%", size: 7, delay: 400, duration: 6400 },
  { left: "50%", size: 3, delay: 2300, duration: 5600 },
  { left: "26%", size: 4, delay: 1200, duration: 5000 },
  { left: "72%", size: 5, delay: 2000, duration: 5400 },
];

function Particle({
  left,
  size,
  delay,
  duration,
}: {
  left: string;
  size: number;
  delay: number;
  duration: number;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, {
          toValue: 1,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, -170] });
  const opacity = t.interpolate({
    inputRange: [0, 0.15, 0.85, 1],
    outputRange: [0, 0.5, 0.5, 0],
  });

  return (
    <Animated.View
      style={{
        position: "absolute",
        bottom: 140,
        left: left as any,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "rgba(255,255,255,0.65)",
        opacity,
        transform: [{ translateY }],
      }}
    />
  );
}

export function AnimatedSplash({ onFinish }: { onFinish: () => void }) {
  const layerOpacity = useRef(new Animated.Value(1)).current;
  const layerScale = useRef(new Animated.Value(1)).current;

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.9)).current;
  const logoY = useRef(new Animated.Value(16)).current;

  const lineScale = useRef(new Animated.Value(0)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;

  const glow = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Background slow drift.
    Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 6000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 6000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Glow breathing.
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();

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
          duration: 550,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(layerScale, {
          toValue: 1.05,
          duration: 550,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) onFinish();
      });
    }, 2300);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const driftX = drift.interpolate({ inputRange: [0, 1], outputRange: [-30, 30] });
  const driftY = drift.interpolate({ inputRange: [0, 1], outputRange: [-20, 20] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.16, 0.4] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] });

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { opacity: layerOpacity, transform: [{ scale: layerScale }] },
      ]}
      pointerEvents="none"
    >
      {/* Base gradient. */}
      <LinearGradient
        colors={["#070B1F", "#15205C", "#3B1E78"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Drifting accent gradient — oversized so the motion never reveals an edge. */}
      <Animated.View
        style={[
          styles.driftLayer,
          { transform: [{ translateX: driftX }, { translateY: driftY }] },
        ]}
      >
        <LinearGradient
          colors={["#3B1E78", "#6D28D9", "#1D4ED8"]}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, { opacity: 0.45 }]}
        />
      </Animated.View>

      {/* Floating particles. */}
      {PARTICLES.map((p, i) => (
        <Particle key={i} {...p} />
      ))}

      <View style={styles.center}>
        {/* Soft glow halo. */}
        <Animated.View
          style={[
            styles.glow,
            { opacity: glowOpacity, transform: [{ scale: glowScale }] },
          ]}
        />

        {/* Logo badge. */}
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
              colors={["#2563EB", "#7C3AED", "#DB2777"]}
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
  driftLayer: {
    position: "absolute",
    top: -60,
    left: -60,
    right: -60,
    bottom: -60,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    top: "32%",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#7C3AED",
  },
  logoCard: {
    backgroundColor: "#fff",
    paddingHorizontal: 30,
    paddingVertical: 24,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
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
    backgroundColor: "rgba(255,255,255,0.18)",
    overflow: "hidden",
  },
  lineFill: {
    ...StyleSheet.absoluteFillObject,
    transformOrigin: "left",
  },
  footer: {
    marginTop: 18,
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: "600",
    textTransform: "uppercase",
  },
});
