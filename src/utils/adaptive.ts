export const getFont = (screen: string) => {
  if (screen === "small") return 14;
  if (screen === "medium") return 16;
  return 18;
};

export const getPadding = (screen: string) => {
  if (screen === "small") return 10;
  if (screen === "medium") return 16;
  return 22;
};

export const getGap = (screen: string) => {
  if (screen === "small") return 8;
  if (screen === "medium") return 12;
  return 16;
};