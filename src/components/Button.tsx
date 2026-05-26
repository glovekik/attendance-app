import { useMemo } from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { COLORS, RADIUS } from "../theme";

import { useTheme } from "../theme/ThemeProvider";
export default function Button({ title, onPress, variant }: any) {
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.btn,
        variant === "danger" && { backgroundColor: COLORS.danger },
      ]}
    >
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
  btn: {
    backgroundColor: COLORS.primary,
    padding: 14,
    borderRadius: RADIUS.md,
    alignItems: "center",
    marginTop: 10,
  },
  text: {
    color: c.text,
    fontWeight: "bold",
  },
});