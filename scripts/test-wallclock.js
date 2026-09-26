/**
 * Tests for src/utils/wallclock.ts.
 *
 * The bug these exist to prevent: a time the user TYPED was being turned into
 * an instant with `new Date(y, m, d, hh, mm).toISOString()`. That reads the
 * typed hours in the *device's* timezone. On a phone set to IST the server's
 * conversion cancelled the error out and nobody saw it. On a desktop left on
 * UTC, an Android emulator (UTC by default), or a laptop carried abroad, it
 * did not cancel — a correction typed as 8:15 PM was sent as an instant the
 * server read as 1:45 AM the next morning, and the approved day was recorded
 * as sixteen hours long.
 *
 * The fix is to send what was typed. So the thing worth testing is that the
 * output does NOT depend on the device's timezone — which is why every case
 * below runs under four of them.
 *
 * Run from the app directory:  node scripts/test-wallclock.js
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const out = fs.mkdtempSync(path.join(os.tmpdir(), "wallclock-"));
execFileSync("npx",
  ["tsc", "src/utils/wallclock.ts", "--outDir", out, "--module", "commonjs",
   "--target", "es2020", "--skipLibCheck"],
  { cwd: path.join(__dirname, ".."), stdio: "inherit" });

const modPath = path.join(out, "wallclock.js");

let P = 0, F = 0;
const eq = (name, got, want) => {
  if (got === want) { P++; console.log(`  PASS  ${name}`); }
  else { F++; console.log(`  FAIL  ${name}\n        got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};

// Every timezone a real user has turned up in: the office, a desktop left on
// UTC, someone working from the US, and one on the far side of the date line
// where the naive approach shifted the DAY as well as the time.
const ZONES = ["Asia/Kolkata", "UTC", "America/New_York", "Pacific/Auckland"];

/** Load the module fresh with TZ set, since Date reads it at construction. */
const underTz = (tz, fn) => {
  const prev = process.env.TZ;
  process.env.TZ = tz;
  delete require.cache[require.resolve(modPath)];
  const mod = require(modPath);
  try { return fn(mod); } finally {
    process.env.TZ = prev;
    delete require.cache[require.resolve(modPath)];
  }
};

console.log("A typed 8:15 PM is 8:15 PM on every device");
for (const tz of ZONES) {
  underTz(tz, ({ wallClockIso, wallClockIsoFromDates, wallClockIsoFromHM }) => {
    const picked = new Date(2026, 8, 4, 20, 15, 0);        // what the picker gives
    eq(`${tz}: from a date string`,
       wallClockIso("2026-09-04", picked), "2026-09-04T20:15:00");
    eq(`${tz}: from two Dates`,
       wallClockIsoFromDates(new Date(2026, 8, 4), picked), "2026-09-04T20:15:00");
    eq(`${tz}: from numeric h:m`,
       wallClockIsoFromHM("2026-09-04", 20, 15), "2026-09-04T20:15:00");
  });
}

console.log("\nWhat the old approach did on those same devices");
for (const tz of ZONES) {
  underTz(tz, () => {
    const old = new Date(2026, 8, 4, 20, 15, 0).toISOString();
    const drifted = !old.startsWith("2026-09-04T20:15");
    console.log(`  note  ${tz.padEnd(18)} toISOString() -> ${old}` +
                (drifted ? "   (drifted)" : ""));
  });
}

console.log("\nPadding and edges");
underTz("UTC", ({ wallClockIso, wallClockIsoFromDates, wallClockIsoFromHM }) => {
  eq("single-digit hour pads",
     wallClockIso("2026-09-04", new Date(2026, 8, 4, 9, 5)), "2026-09-04T09:05:00");
  eq("midnight is 00:00, not 24:00",
     wallClockIso("2026-09-04", new Date(2026, 8, 4, 0, 0)), "2026-09-04T00:00:00");
  eq("one minute to midnight",
     wallClockIso("2026-09-04", new Date(2026, 8, 4, 23, 59)), "2026-09-04T23:59:00");
  eq("seconds are always zeroed",
     wallClockIso("2026-09-04", new Date(2026, 8, 4, 18, 30, 47)), "2026-09-04T18:30:00");
  // The day comes from the record being corrected, never from the picker's
  // own date — the picker only contributes hours and minutes.
  eq("the picker's date is ignored",
     wallClockIso("2026-09-04", new Date(1999, 0, 1, 20, 15)), "2026-09-04T20:15:00");
  eq("a single-digit month and day pad",
     wallClockIsoFromDates(new Date(2026, 0, 7), new Date(2026, 0, 7, 8, 5)),
     "2026-01-07T08:05:00");
  eq("no trailing Z — that would make it an instant again",
     wallClockIsoFromHM("2026-09-04", 20, 15).includes("Z"), false);
});

console.log(`\n${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
