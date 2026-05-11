import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { COLORS, RADIUS } from "../theme";

export default function Button({ title, onPress, variant }: any) {
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

const styles = StyleSheet.create({
  btn: {
    backgroundColor: COLORS.primary,
    padding: 14,
    borderRadius: RADIUS.md,
    alignItems: "center",
    marginTop: 10,
  },
  text: {
    color: "#fff",
    fontWeight: "bold",
  },
});