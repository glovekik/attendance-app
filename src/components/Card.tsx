import { View, StyleSheet } from "react-native";
import { COLORS, RADIUS } from "../theme";

export default function Card({ children }: any) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
  },
});