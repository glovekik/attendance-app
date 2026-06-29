import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance, Platform, Dimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Theme, buildTheme, webThemeOverrides } from "./tokens";

const STORAGE_KEY = "@app/theme-pref";

export type ThemePreference = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Wraps the app. Persists the user's preference (light/dark/system) and
 * honors device colorScheme when preference === "system".
 *
 * Default is "system" so first-time users get whatever their OS prefers
 * (most are on light on iOS, dark on Android — the toggle lets them
 * override either way).
 */
export const ThemeProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [preference, setPreferenceState] =
    useState<ThemePreference>("system");
  const [systemScheme, setSystemScheme] = useState<"light" | "dark">(
    () => (Appearance.getColorScheme() === "dark" ? "dark" : "light")
  );

  // Load persisted preference on mount.
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === "light" || stored === "dark" || stored === "system") {
          setPreferenceState(stored);
        }
      } catch {
        /* fall back to default */
      }
    })();
  }, []);

  // Track device scheme changes (only relevant when preference is "system").
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme === "dark" ? "dark" : "light");
    });
    return () => sub.remove();
  }, []);

  const setPreference = useCallback(async (p: ThemePreference) => {
    setPreferenceState(p);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, p);
    } catch {
      /* persistence failure is non-fatal */
    }
  }, []);

  const theme = useMemo(() => {
    const effective =
      preference === "system" ? systemScheme : preference;
    const baseTheme = buildTheme(effective);

    // Apply Keka-style overrides only on desktop web
    const isDesktopWeb =
      Platform.OS === "web" && Dimensions.get("window").width >= 1024;

    if (isDesktopWeb) {
      return {
        ...baseTheme,
        colors: {
          ...baseTheme.colors,
          ...webThemeOverrides.colors,
        },
      };
    }

    return baseTheme;
  }, [preference, systemScheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, preference, setPreference }),
    [theme, preference, setPreference]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

/**
 * Hook to read the active theme. Throws if used outside the provider so
 * misuse fails loudly during development.
 */
export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error(
      "useTheme() must be used within <ThemeProvider>. " +
        "Wrap the root layout."
    );
  }
  return ctx;
};
