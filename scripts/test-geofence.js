/**
 * Geofence tests for src/utils/location.ts.
 *
 * There is no test runner in this project, so this compiles the one module
 * under test with tsc, stubs the two native imports it pulls in, and asserts
 * against it. Run from the app directory:
 *
 *     node scripts/test-geofence.js
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");

const out = fs.mkdtempSync(path.join(os.tmpdir(), "geofence-"));
execFileSync(
  "npx",
  ["tsc", "src/utils/location.ts", "--outDir", out, "--module", "commonjs",
   "--target", "es2020", "--skipLibCheck", "--esModuleInterop",
   "--moduleResolution", "node"],
  { cwd: path.join(__dirname, ".."), stdio: "inherit" }
);

let PLATFORM = "web";
const origLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === "react-native") {
    return { Platform: { get OS() { return PLATFORM; } } };
  }
  if (req === "expo-location") {
    return { Accuracy: { High: 4 }, reverseGeocodeAsync: async () => [] };
  }
  return origLoad.apply(this, [req, ...rest]);
};

const L = require(path.join(out, "location.js"));
let P = 0, F = 0;
const expect = (name, cond, detail = "") => {
  if (cond) { P++; console.log(`  PASS  ${name}`); }
  else { F++; console.log(`  FAIL  ${name}\n        ${detail}`); }
};

const OFFICE = L.OFFICE;
console.log(`office: ${OFFICE.latitude}, ${OFFICE.longitude}  radius=${L.ALLOWED_RADIUS}m`);
console.log(`allowance=${L.ACCURACY_ALLOWANCE}m  unreliable>${L.UNRELIABLE_ACCURACY}m\n`);

// Move north by N metres. getDistance models a sphere of R=6371km, so a
// degree of latitude there is exactly R*pi/180. Using an ellipsoidal
// (WGS84) figure instead mixes two earth models and shows up as a ~0.5%
// error that looks like a bug in the haversine rather than in the test.
const M_PER_DEG_LAT = (6371e3 * Math.PI) / 180;
const north = (m) => ({ latitude: OFFICE.latitude + m / M_PER_DEG_LAT, longitude: OFFICE.longitude });

// ---- distance maths ------------------------------------------------------
const d0 = L.getDistance(OFFICE.latitude, OFFICE.longitude, OFFICE.latitude, OFFICE.longitude);
expect("distance to itself is 0", d0 === 0, String(d0));
const d100 = L.getDistance(OFFICE.latitude, OFFICE.longitude, north(100).latitude, north(100).longitude);
expect("100m north measures ~100m", Math.abs(d100 - 100) < 1, `got ${d100.toFixed(2)}`);
const d5k = L.getDistance(OFFICE.latitude, OFFICE.longitude, north(5000).latitude, north(5000).longitude);
expect("5km north measures ~5000m", Math.abs(d5k - 5000) < 5, `got ${d5k.toFixed(1)}`);
// Known real-world check: office (Hyderabad) → old office (Vijayawada) ~245km
const vij = L.getDistance(17.421639, 78.460774, 16.507020515758303, 80.62279856266548);
// 251.4km, verified independently rather than guessed.
expect("Hyderabad→Vijayawada ~251km", Math.abs(vij - 251400) < 1000, `got ${(vij/1000).toFixed(1)}km`);

// ---- at the desk, good fix ----------------------------------------------
expect("dead centre, 20m accuracy → inside",
  L.classifyOffice({ ...north(0), accuracy: 20 }).inside);
expect("150m out, 30m accuracy → inside (within radius)",
  L.classifyOffice({ ...north(150), accuracy: 30 }).inside);

// ---- THE BUG: at the desk, typical desktop WiFi fix ----------------------
const desk = L.classifyOffice({ ...north(280), accuracy: 120 });
expect("280m out with 120m accuracy → inside (uncertainty reaches office)",
  desk.inside, JSON.stringify(desk));
expect("...and is still reported as reliable", desk.reliable);

// Just inside / just outside the radius+allowance boundary (200+150=350).
// Asserting exactly 350 would be testing floating point: the haversine
// returns 350.0000000000887 for that offset and loses by 1e-10 m, which no
// real fix could ever distinguish.
const edge = L.classifyOffice({ ...north(349), accuracy: 150 });
expect("349m out with 150m accuracy → inside (just within the allowance)",
  edge.inside, JSON.stringify(edge));

// ---- genuinely away must STILL be refused --------------------------------
expect("500m out, 10m accuracy → outside",
  !L.classifyOffice({ ...north(500), accuracy: 10 }).inside);
expect("351m out with 150m accuracy → outside (1m past the allowance)",
  !L.classifyOffice({ ...north(351), accuracy: 150 }).inside);
expect("2km out, 300m accuracy → outside (allowance is capped at 150)",
  !L.classifyOffice({ ...north(2000), accuracy: 300 }).inside);
expect("Vijayawada with 400m accuracy → outside",
  !L.classifyOffice({ latitude: 16.507020515758303, longitude: 80.62279856266548, accuracy: 400 }).inside);

// ---- a vague fix must not be usable as a way in --------------------------
const vague = L.classifyOffice({ ...north(300), accuracy: 50000 });
expect("50km-accuracy fix → not reliable", !vague.reliable, JSON.stringify(vague));
expect("50km-accuracy fix → not inside, even 300m away", !vague.inside);
const atDeskVague = L.classifyOffice({ ...north(0), accuracy: 5000 });
expect("standing at the office with a 5km fix → not inside (we can't tell)",
  !atDeskVague.inside && !atDeskVague.reliable);

// ---- platforms that report no accuracy ----------------------------------
expect("null accuracy inside radius → inside",
  L.classifyOffice({ ...north(100), accuracy: null }).inside);
expect("null accuracy outside radius → outside (no free allowance)",
  !L.classifyOffice({ ...north(300), accuracy: null }).inside);
expect("null accuracy counts as reliable",
  L.classifyOffice({ ...north(100), accuracy: null }).reliable);

// ---- messages -----------------------------------------------------------
const farMsg = L.officeRejectionMessage(L.classifyOffice({ ...north(500), accuracy: 10 }));
expect("far message states the distance", /\d+m away/.test(farMsg), farMsg);
const vagueMsg = L.officeRejectionMessage(vague);
expect("vague message explains accuracy, not distance",
  /accurate to about/.test(vagueMsg) && !/m away/.test(vagueMsg), vagueMsg);

console.log(`\n${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
