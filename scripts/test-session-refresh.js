/**
 * Tests for refreshSession() in src/services/session.ts.
 *
 * The distinction under test is the whole point of the module: a server that
 * says "this session is over" must log the user out, and a server you simply
 * couldn't reach must not. Conflating the two is what signed people out for
 * no reason.
 *
 * No test runner in this project, so this compiles the module with tsc and
 * stubs its two imports. Run from the app directory:
 *
 *     node scripts/test-session-refresh.js
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");

const out = fs.mkdtempSync(path.join(os.tmpdir(), "session-"));
execFileSync(
  "npx",
  ["tsc", "src/services/session.ts", "--outDir", out, "--module", "commonjs",
   "--target", "es2020", "--skipLibCheck", "--esModuleInterop",
   "--moduleResolution", "node"],
  { cwd: path.join(__dirname, ".."), stdio: "inherit" }
);

// ---- stubs ---------------------------------------------------------------
const store = new Map();
const asyncStorage = {
  getItem: async (k) => (store.has(k) ? store.get(k) : null),
  setItem: async (k, v) => void store.set(k, v),
  multiRemove: async (ks) => ks.forEach((k) => store.delete(k)),
};

// What the server will do on the next call(s).
let plan = [];
let calls = [];
const refreshAccessToken = async (rt) => {
  calls.push(rt);
  const next = plan.shift();
  if (!next) throw Object.assign(new Error("no plan"), { status: 500 });
  if (next.throw) throw next.throw;
  return next.value;
};

const origLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === "@react-native-async-storage/async-storage") {
    return { default: asyncStorage, ...asyncStorage };
  }
  if (req.endsWith("/api") || req === "./api") {
    return { refreshAccessToken, logoutApi: async () => {} };
  }
  return origLoad.apply(this, [req, ...rest]);
};

// tsc also compiles ./api, so the emitted tree mirrors src/ rather than
// dropping session.js at the root. Find it instead of guessing.
const findEmitted = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      const hit = findEmitted(full);
      if (hit) return hit;
    } else if (e.name === "session.js") return full;
  }
  return null;
};
const emitted = findEmitted(out);
if (!emitted) throw new Error(`session.js not emitted under ${out}`);
const S = require(emitted);

let P = 0, F = 0;
const expect = (name, cond, detail = "") => {
  if (cond) { P++; console.log(`  PASS  ${name}`); }
  else { F++; console.log(`  FAIL  ${name}\n        ${detail}`); }
};

const reset = (withToken = true) => {
  store.clear();
  if (withToken) {
    store.set("token", "old-access");
    store.set("refresh_token", "RT-OLD");
  }
  plan = [];
  calls = [];
};

const httpErr = (status) => Object.assign(new Error(`HTTP ${status}`), { status });
const netErr = () => new TypeError("Network request failed"); // no .status

(async () => {
  // ---- the happy path ----------------------------------------------------
  reset();
  plan = [{ value: { access_token: "new-access", refresh_token: "RT-NEW" } }];
  let r = await S.refreshSession();
  expect("success → refreshed", r.status === "refreshed", JSON.stringify(r));
  expect("success → returns the new access token", r.token === "new-access");
  expect("success → stores the new access token",
    store.get("token") === "new-access", store.get("token"));
  expect("success → stores the rotated refresh token",
    store.get("refresh_token") === "RT-NEW", store.get("refresh_token"));

  // A server that doesn't rotate must not wipe the token we already hold.
  reset();
  plan = [{ value: { access_token: "new-access" } }];
  r = await S.refreshSession();
  expect("no rotation → keeps the existing refresh token",
    r.status === "refreshed" && store.get("refresh_token") === "RT-OLD",
    store.get("refresh_token"));

  // ---- the server's verdict ends the session ------------------------------
  reset();
  plan = [{ throw: httpErr(401) }];
  r = await S.refreshSession();
  expect("401 → dead", r.status === "dead", JSON.stringify(r));
  expect("401 → asked once, no pointless retry", calls.length === 1, String(calls.length));

  reset();
  plan = [{ throw: httpErr(403) }];
  r = await S.refreshSession();
  expect("403 → dead", r.status === "dead", JSON.stringify(r));

  reset(false);
  r = await S.refreshSession();
  expect("nothing stored → dead", r.status === "dead", JSON.stringify(r));
  expect("nothing stored → no network call", calls.length === 0);

  // ---- THE BUG: not reaching the server must not end the session ---------
  reset();
  plan = [{ throw: netErr() }, { throw: netErr() }];
  r = await S.refreshSession();
  expect("offline → unavailable, NOT dead", r.status === "unavailable", JSON.stringify(r));
  expect("offline → retried once", calls.length === 2, String(calls.length));
  expect("offline → the session is left intact",
    store.get("refresh_token") === "RT-OLD" && store.get("token") === "old-access");

  for (const code of [500, 502, 503, 504]) {
    reset();
    plan = [{ throw: httpErr(code) }, { throw: httpErr(code) }];
    r = await S.refreshSession();
    expect(`${code} → unavailable, NOT dead`, r.status === "unavailable", JSON.stringify(r));
  }

  // A 200 with an empty body says nothing about the session either.
  reset();
  plan = [{ value: {} }, { value: {} }];
  r = await S.refreshSession();
  expect("empty 200 → unavailable, NOT dead", r.status === "unavailable", JSON.stringify(r));

  // ---- the retry is what saves the common case ---------------------------
  reset();
  plan = [{ throw: netErr() },
          { value: { access_token: "new-access", refresh_token: "RT-NEW" } }];
  r = await S.refreshSession();
  expect("blip then success → refreshed", r.status === "refreshed", JSON.stringify(r));
  expect("blip then success → replays the same refresh token",
    calls[0] === "RT-OLD" && calls[1] === "RT-OLD", JSON.stringify(calls));

  // A retry that comes back 401 is still a real verdict.
  reset();
  plan = [{ throw: netErr() }, { throw: httpErr(401) }];
  r = await S.refreshSession();
  expect("blip then 401 → dead", r.status === "dead", JSON.stringify(r));

  // ---- single-flight ------------------------------------------------------
  reset();
  plan = [{ value: { access_token: "new-access", refresh_token: "RT-NEW" } }];
  const [a, b, cc] = await Promise.all([
    S.refreshSession(), S.refreshSession(), S.refreshSession(),
  ]);
  expect("concurrent callers share ONE network refresh",
    calls.length === 1, String(calls.length));
  expect("concurrent callers all get the same answer",
    a.status === "refreshed" && b.token === a.token && cc.token === a.token);

  // A later call starts a fresh attempt rather than reusing the settled one.
  plan = [{ throw: httpErr(401) }];
  const later = await S.refreshSession();
  expect("a later call refreshes again", later.status === "dead", JSON.stringify(later));

  console.log(`\n${P} passed, ${F} failed`);
  process.exit(F ? 1 : 0);
})();
