import { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { COLORS, RADIUS } from "../theme";

import { useTheme } from "../theme/ThemeProvider";
export default function Card({ children }: any) {
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  return <View style={styles.card}>{children}</View>;
}

const makeStyles = (c: any) => StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
  },
});