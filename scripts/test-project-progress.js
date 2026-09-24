/**
 * Tests for the progress maths in src/components/ProjectProgress.tsx.
 * Run from the app directory:  node scripts/test-project-progress.js
 */
const { execFileSync } = require("child_process");
const fs = require("fs"); const os = require("os"); const path = require("path");
const Module = require("module");

const out = fs.mkdtempSync(path.join(os.tmpdir(), "progress-"));
execFileSync("npx",
  ["tsc", "src/components/ProjectProgress.tsx", "--outDir", out, "--jsx", "react",
   "--module", "commonjs", "--target", "es2020", "--skipLibCheck",
   "--esModuleInterop", "--moduleResolution", "node", "--noEmitOnError", "false"],
  { cwd: path.join(__dirname, ".."), stdio: "pipe" });

const origLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === "react") return { default: {}, useMemo: (f) => f() };
  if (req === "react-native") return { View: null, Text: null, StyleSheet: { create: (o) => o } };
  if (req.includes("ThemeProvider")) return { useTheme: () => ({ theme: { colors: {} } }) };
  return origLoad.apply(this, [req, ...rest]);
};

const find = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  const f = path.join(d, e.name);
  if (e.isDirectory()) { const h = find(f); if (h) return h; }
  else if (e.name === "ProjectProgress.js") return f; } return null; };
const P_ = require(find(out));

let P = 0, F = 0;
const eq = (n, got, want) => { if (got === want) { P++; console.log(`  PASS  ${n}`); }
  else { F++; console.log(`  FAIL  ${n}\n        got ${got} want ${want}`); } };

const DAY = 86400000;
const at = (iso) => new Date(`${iso}T12:00:00Z`).getTime();

console.log("--- scheduleFraction ---");
eq("start of the window is 0", P_.scheduleFraction("2026-01-01", "2026-12-31", at("2026-01-01")) < 0.01, true);
eq("halfway is ~0.5", Math.abs(P_.scheduleFraction("2026-01-01", "2026-12-31", at("2026-07-02")) - 0.5) < 0.02, true);
eq("past the end clamps to 1", P_.scheduleFraction("2026-01-01", "2026-06-30", at("2026-12-01")), 1);
eq("before the start clamps to 0", P_.scheduleFraction("2026-06-01", "2026-12-31", at("2026-01-01")), 0);
eq("no end date -> null", P_.scheduleFraction("2026-01-01", null), null);
eq("no start date -> null", P_.scheduleFraction(null, "2026-12-31"), null);
eq("end before start -> null", P_.scheduleFraction("2026-12-31", "2026-01-01"), null);
eq("a one-day project still yields a fraction within that day",
   (() => { const f = P_.scheduleFraction("2026-05-05", "2026-05-05", at("2026-05-05"));
            return f !== null && f >= 0 && f <= 1; })(), true);
eq("garbage dates -> null", P_.scheduleFraction("not-a-date", "2026-12-31"), null);

console.log("--- daysRemaining ---");
eq("ten days out", P_.daysRemaining("2026-01-11", at("2026-01-01")), 10);
eq("due today is exactly 0", P_.daysRemaining("2026-01-01", at("2026-01-01")), 0);
eq("tomorrow is exactly 1", P_.daysRemaining("2026-01-02", at("2026-01-01")), 1);
eq("yesterday is exactly -1", P_.daysRemaining("2025-12-31", at("2026-01-01")), -1);
eq("overdue is negative", P_.daysRemaining("2026-01-01", at("2026-01-11")) < 0, true);
eq("no end date -> null", P_.daysRemaining(null), null);
eq("garbage -> null", P_.daysRemaining("soon"), null);

console.log(`\n${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
