/**
 * Tests for src/validators — the rules every form now shares.
 * Run from the app directory:  node scripts/test-validators.js
 */
const { execFileSync } = require("child_process");
const fs = require("fs"); const os = require("os"); const path = require("path");

const out = fs.mkdtempSync(path.join(os.tmpdir(), "validators-"));
execFileSync("npx",
  ["tsc", "src/validators/index.ts", "--outDir", out, "--module", "commonjs",
   "--target", "es2020", "--skipLibCheck"],
  { cwd: path.join(__dirname, ".."), stdio: "inherit" });
const V = require(path.join(out, "index.js"));

let P = 0, F = 0;
const ok = (n, c, d = "") => { if (c) { P++; console.log(`  PASS  ${n}`); }
  else { F++; console.log(`  FAIL  ${n}\n        ${d}`); } };
const valid = (fn, v, label) => ok(`${label}: ${JSON.stringify(v)} accepted`, fn(v) === null, String(fn(v)));
const invalid = (fn, v, label) => ok(`${label}: ${JSON.stringify(v)} rejected`, fn(v) !== null, "accepted but shouldn't be");

console.log("--- phone: the examples from the brief ---");
valid(V.validatePhone, "9876543210", "phone");
invalid(V.validatePhone, "98765abc10", "phone");
invalid(V.validatePhone, "12345", "phone");

console.log("--- phone: shapes people actually type ---");
for (const v of ["+91 98765 43210", "+919876543210", "098765 43210",
                 "98765-43210", "(987) 654-3210"])
  valid(V.validatePhone, v, "phone");

console.log("--- phone: the real production values ---");
valid(V.validatePhone, "7382729772", "phone");          // typical stored value
invalid(V.validatePhone, "80082555584", "phone");        // 11 digits, in the DB today
valid(V.validatePhone, "+917207327370", "phone");        // +91 prefixed, in the DB today

console.log("--- phone: rules ---");
invalid(V.validatePhone, "1234567890", "phone");         // starts with 1
invalid(V.validatePhone, "5876543210", "phone");         // starts with 5
valid(V.validatePhone, "6000000000", "phone");
invalid(V.validatePhone, "98765432101", "phone");        // 11 digits
invalid(V.validatePhone, "987654321", "phone");          // 9 digits
invalid(V.validatePhone, "98765$43210", "phone");
ok("phone: empty is not this validator's problem", V.validatePhone("") === null);
ok("phone: message names the actual length",
   /you've entered 5/.test(V.validatePhone("12345")), V.validatePhone("12345"));

console.log("--- phone: normalize stores ten digits, never a guess ---");
ok("normalize strips +91", V.normalizePhone("+91 98765 43210") === "9876543210", V.normalizePhone("+91 98765 43210"));
ok("normalize strips trunk 0", V.normalizePhone("098765 43210") === "9876543210");
ok("normalize leaves a valid number alone", V.normalizePhone("9876543210") === "9876543210");
ok("normalize does NOT mangle an invalid one",
   V.normalizePhone("12345") === "12345", V.normalizePhone("12345"));

console.log("--- email ---");
for (const v of ["name@company.com", "a.b+tag@sub.domain.co.in"]) valid(V.validateEmail, v, "email");
for (const v of ["nope", "a@b", "a b@c.com", "@c.com", "a@.com", "a@c."]) invalid(V.validateEmail, v, "email");
ok("email: empty is not this validator's problem", V.validateEmail("") === null);

console.log("--- required ---");
ok("required rejects empty", V.required("Phone")("") === "Phone is required.");
ok("required rejects whitespace", V.required("Phone")("   ") !== null);
ok("required accepts a value", V.required("Phone")("x") === null);

console.log("--- digits (PIN code) ---");
valid(V.validateDigits("PIN code", 6), "500020", "pin");
invalid(V.validateDigits("PIN code", 6), "5000", "pin");
invalid(V.validateDigits("PIN code", 6), "50002a", "pin");

console.log("--- date ---");
valid(V.validateDate("Date of birth", { pastOnly: true }), "2005-05-05", "date");
invalid(V.validateDate("Date of birth"), "05-05-2005", "date");
invalid(V.validateDate("Date of birth"), "2026-02-31", "date");   // rolls into March
invalid(V.validateDate("Date of birth", { pastOnly: true }), "2099-01-01", "date");
valid(V.validateDate("Expiry"), "2099-01-01", "date");            // future fine when allowed

console.log("--- composition ---");
const both = V.all(V.required("Phone"), V.validatePhone);
ok("all() reports the first failure", both("") === "Phone is required.");
ok("all() falls through to the next rule", /10-digit/.test(both("123")), both("123"));
ok("all() passes a good value", both("9876543210") === null);

console.log(`\n${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
