/**
 * Tests for formatHours / formatTotalHours in src/utils/duration.ts.
 *
 * The bug these exist to prevent: 9 hours 48 minutes is 9.8 in decimal, and
 * printing that as "9.80h" gets read as nine hours and eighty minutes.
 *
 * Run from the app directory:  node scripts/test-duration.js
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const out = fs.mkdtempSync(path.join(os.tmpdir(), "duration-"));
execFileSync("npx",
  ["tsc", "src/utils/duration.ts", "--outDir", out, "--module", "commonjs",
   "--target", "es2020", "--skipLibCheck"],
  { cwd: path.join(__dirname, ".."), stdio: "inherit" });

const { formatHours, formatTotalHours } = require(path.join(out, "duration.js"));

let P = 0, F = 0;
const eq = (name, got, want) => {
  if (got === want) { P++; console.log(`  PASS  ${name}`); }
  else { F++; console.log(`  FAIL  ${name}\n        got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};

// The exact numbers reported, both times. The second came from the dashboard
// KPI, which was still building its own string and never called this at all —
// so the helper was right and unused, which a test of the helper can't catch.
eq("9.8 reads as 9h 48m, not 9.80h", formatHours(9.8), "9h 48m");
eq("9.87 reads as 9h 52m, not 9.87h", formatHours(9.87), "9h 52m");

// Real values pulled from production attendance rows.
eq("9.01 -> 9h 01m", formatHours(9.01), "9h 01m");
eq("9.31 -> 9h 19m", formatHours(9.31), "9h 19m");
eq("8.91 -> 8h 55m", formatHours(8.91), "8h 55m");
eq("10.76 -> 10h 46m", formatHours(10.76), "10h 46m");
eq("8.4 -> 8h 24m", formatHours(8.4), "8h 24m");

// Minutes must pad, or 9.01 reads as "9h 1m".
eq("single-digit minutes pad", formatHours(5.05), "5h 03m");

// Whole hours.
eq("8 -> 8h 00m", formatHours(8), "8h 00m");

// The carry the old inline version got wrong: round(0.999*60) is 60.
eq("1.999 carries to 2h 00m, never 1h 60m", formatHours(1.999), "2h 00m");
eq("0.999 carries to 1h 00m", formatHours(0.999), "1h 00m");

// Sub-hour.
eq("0.25 -> 0h 15m", formatHours(0.25), "0h 15m");

// Nothing worked / no data.
eq("0 is not a duration", formatHours(0), "—");
eq("negative is not a duration", formatHours(-3), "—");
eq("null -> em dash", formatHours(null), "—");
eq("undefined -> em dash", formatHours(undefined), "—");
eq("NaN -> em dash", formatHours(NaN), "—");
eq("Infinity -> em dash", formatHours(Infinity), "—");

// Totals: a zero week is a real answer, not missing data.
eq("total 0 -> 0h 00m", formatTotalHours(0), "0h 00m");
eq("total 41.33 -> 41h 20m", formatTotalHours(41.33), "41h 20m");
eq("total null -> em dash", formatTotalHours(null), "—");

console.log(`\n${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
