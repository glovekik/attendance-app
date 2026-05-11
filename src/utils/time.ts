export const isWithinOfficeHours = () => {
  const now = new Date();
  const hour = now.getHours();

  return hour >= 9 && hour <= 11;
};

export const getTodayKey = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};