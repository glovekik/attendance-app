import { useWindowDimensions } from "react-native";

export function useScreen() {
  const { width } = useWindowDimensions();

  if (width < 400) return "small";
  if (width < 768) return "medium";
  return "large";
}