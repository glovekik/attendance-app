const DEBUG = true;

export const logLocationDebug = (
  userLat: number,
  userLon: number,
  officeLat: number,
  officeLon: number,
  distance: number
) => {
  if (!DEBUG) return;

  console.log("📍 ===== LOCATION DEBUG =====");
  console.log("User Location:", userLat, userLon);
  console.log("Office Location:", officeLat, officeLon);
  console.log("Distance (meters):", distance);
  console.log("=============================");
};