import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { COLORS, RADIUS } from "../theme";

export default function InputCard({ label, value, onPress }: any) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.box} onPress={onPress}>
        <Text>{value || "Select"}</Text>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    fontWeight: "600",
    marginBottom: 6,
  },
  box: {
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    borderRadius: RADIUS.sm,
    marginBottom: 10,
  },
});