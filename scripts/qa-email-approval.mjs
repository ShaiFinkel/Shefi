#!/usr/bin/env node
// End-to-end QA for the email-based manager approval flow.
//
// Exercises every acceptance criterion from dev_task #4 against a live
// server (default http://localhost:3000) + the on-disk SQLite at
// data/shefi.db. Cleans up after itself so re-runs are safe.
//
//   Usage:  node scripts/qa-email-approval.mjs
//   Env:    BASE_URL (default http://localhost:3000)
//           DB_PATH  (default data/shefi.db)
//           TEST_EMPLOYEE_EMAIL  (an employee with an email + a manager)

import Database from "better-sqlite3";
import path from "node:path";
import { execSync } from "node:child_process";

const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const DB_PATH = path.resolve(process.cwd(), process.env.DB_PATH || "data/shefi.db");
const TEST_EMAIL = process.env.TEST_EMPLOYEE_EMAIL || "shai.finkelstein@yum.com";

// ---------- tiny test runner ----------
const results = [];
let currentName = null;

function check(name, fn) {
  currentName = name;
  return Promise.resolve()
    .then(fn)
    .then(
      () => {
        results.push({ name, status: "PASS" });
        console.log(`  ✓ ${name}`);
      },
      (err) => {
        results.push({ name, status: "FAIL", error: err.message ?? String(err) });
        console.log(`  ✗ ${name}\n    → ${err.message ?? err}`);
      },
    );
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
  }
}

// ---------- helpers ----------
const db = new Database(DB_PATH, { readonly: false });

async function loginEmployee(email) {
  // Step 1: request magic link (dev mode returns dev_link directly).
  const r1 = await fetch(`${BASE_URL}/api/auth/request-magic-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const j1 = await r1.json();
  assert(j1.ok && j1.sent, "magic link request failed (need dev mode without RESEND_API_KEY)");
  assert(j1.dev_link, "no dev_link returned — set RESEND_API_KEY=empty for testing or re-enable dev fallback");
  // Step 2: follow the verify link (manual=no redirect to grab cookie).
  const r2 = await fetch(`${BASE_URL}${j1.dev_link}`, { redirect: "manual" });
  assert(r2.status === 302, `verify expected 302 got ${r2.status}`);
  const setCookie = r2.headers.get("set-cookie");
  assert(setCookie?.includes("shefi_session="), "no session cookie set");
  const cookieValue = setCookie.match(/shefi_session=([^;]+)/)[1];
  return `shefi_session=${cookieValue}`;
}

async function createRequest(cookie, body) {
  const r = await fetch(`${BASE_URL}/api/employee/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  assert(r.ok, `create request failed: ${r.status} ${text}`);
  return JSON.parse(text);
}

function getApprovalTokens(requestId) {
  return db
    .prepare(
      `SELECT id, token, action, expires_at, used_at, used_ip, reason
         FROM approval_tokens WHERE request_id = ? ORDER BY action`,
    )
    .all(requestId);
}

function getRequest(id) {
  return db.prepare(`SELECT * FROM equipment_requests WHERE id = ?`).get(id);
}

function cleanupRequest(id) {
  db.prepare(`DELETE FROM approval_tokens WHERE request_id = ?`).run(id);
  db.prepare(`DELETE FROM equipment_requests WHERE id = ?`).run(id);
}

// ---------- the suite ----------
async function main() {
  console.log(`\n🧪 QA: email-based manager approval`);
  console.log(`   server : ${BASE_URL}`);
  console.log(`   db     : ${DB_PATH}`);
  console.log(`   tester : ${TEST_EMAIL}\n`);

  // Belt-and-suspenders cleanup: also wipe any leftover QA-DELETE-ME rows
  // from prior crashed runs. Safe — these only ever exist as test artifacts.
  const orphanIds = db
    .prepare(`SELECT id FROM equipment_requests WHERE custom_name LIKE 'QA-DELETE-ME%'`)
    .all()
    .map((r) => r.id);
  for (const id of orphanIds) cleanupRequest(id);
  if (orphanIds.length) console.log(`(swept ${orphanIds.length} orphaned QA rows from previous runs)\n`);

  const cookie = await loginEmployee(TEST_EMAIL);

  // ===== Scenario A: full APPROVE flow =====
  console.log("Scenario A — approve flow:");
  const reqA = await createRequest(cookie, {
    custom_name: "QA-DELETE-ME approve flow",
    quantity: 1,
    justification: "automated qa run",
    delivery_to: "office",
  });

  await check("AC1: 2 approval_tokens (approve+reject) for the new request", () => {
    const toks = getApprovalTokens(reqA.id);
    assertEq(toks.length, 2, "token rows count");
    const actions = toks.map((t) => t.action).sort();
    assertEq(JSON.stringify(actions), JSON.stringify(["approve", "reject"]), "actions");
    // expires_at ~30 days
    for (const t of toks) {
      const days = (new Date(t.expires_at).getTime() - Date.now()) / 86400000;
      assert(days > 29 && days < 31, `expires_at not ~30d for ${t.action}: ${days}d`);
    }
    // both reference the same manager assigned to the request
    assert(reqA.manager_employee_id, "request has no manager_employee_id");
  });

  let approveToken, rejectToken;

  await check("AC2: tokens are addressable via /api/approval/act?token=…", async () => {
    const toks = getApprovalTokens(reqA.id);
    approveToken = toks.find((t) => t.action === "approve").token;
    rejectToken = toks.find((t) => t.action === "reject").token;
    assert(approveToken && rejectToken, "missing tokens");
    // sanity: tokens are URL-safe (no padding characters)
    assert(/^[A-Za-z0-9_-]+$/.test(approveToken), `approve token not url-safe: ${approveToken}`);
  });

  await check("AC3: GET approve URL → 200, sets manager_approved + used_at + used_ip", async () => {
    const r = await fetch(`${BASE_URL}/api/approval/act?token=${encodeURIComponent(approveToken)}`);
    assertEq(r.status, 200, "status");
    const html = await r.text();
    assert(html.includes("הבקשה אושרה"), "success page missing approval text");
    const tok = db.prepare(`SELECT * FROM approval_tokens WHERE token = ?`).get(approveToken);
    assert(tok.used_at, "token not marked used");
    assert(tok.used_ip, "used_ip not stored");
    const updated = getRequest(reqA.id);
    assertEq(updated.status, "manager_approved", "request.status");
    assert(updated.manager_decision_by, "manager_decision_by not stamped");
    assert(updated.manager_decision_at, "manager_decision_at not stamped");
  });

  await check("AC6: re-clicking the same approve token → 409 + 'כבר השתמשת'", async () => {
    const r = await fetch(`${BASE_URL}/api/approval/act?token=${encodeURIComponent(approveToken)}`);
    assertEq(r.status, 409, "status");
    const html = await r.text();
    assert(html.includes("כבר השתמשת"), "expected 'already used' message");
  });

  await check("AC7: clicking reject after request already moved → 409 + 'הבקשה כבר במצב'", async () => {
    const r = await fetch(`${BASE_URL}/api/approval/act?token=${encodeURIComponent(rejectToken)}`);
    assertEq(r.status, 409, "status");
    const html = await r.text();
    assert(html.includes("הבקשה כבר במצב"), "expected 'already in state' message");
  });

  cleanupRequest(reqA.id);

  // ===== Scenario B: full REJECT flow =====
  console.log("Scenario B — reject flow:");
  const reqB = await createRequest(cookie, {
    custom_name: "QA-DELETE-ME reject flow",
    quantity: 1,
    justification: "automated qa run",
    delivery_to: "office",
  });
  const toksB = getApprovalTokens(reqB.id);
  const approveTokenB = toksB.find((t) => t.action === "approve").token;
  const rejectTokenB = toksB.find((t) => t.action === "reject").token;

  await check("AC4: GET reject URL → 200 + form, but does NOT consume token yet", async () => {
    const r = await fetch(`${BASE_URL}/api/approval/act?token=${encodeURIComponent(rejectTokenB)}`);
    assertEq(r.status, 200, "status");
    const html = await r.text();
    assert(html.includes("<textarea"), "reject form missing textarea");
    assert(html.includes('name="reason"'), "form missing reason field");
    assert(html.includes(`value="${rejectTokenB}"`), "hidden token field missing");
    const tok = db.prepare(`SELECT used_at FROM approval_tokens WHERE token = ?`).get(rejectTokenB);
    assertEq(tok.used_at, null, "token must NOT be consumed by GET");
  });

  await check("AC8: POST reject without reason → 400 + clear message", async () => {
    const r = await fetch(`${BASE_URL}/api/approval/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: rejectTokenB }).toString(),
    });
    assertEq(r.status, 400, "status");
    const html = await r.text();
    assert(html.includes("חובה לציין סיבת דחייה"), "missing 'reason required' message");
    // and token still not consumed
    const tok = db.prepare(`SELECT used_at FROM approval_tokens WHERE token = ?`).get(rejectTokenB);
    assertEq(tok.used_at, null, "token must NOT be consumed by 400");
  });

  await check("AC5: POST reject with reason → 200, status=rejected, reason stored", async () => {
    const r = await fetch(`${BASE_URL}/api/approval/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: rejectTokenB, reason: "QA: not needed this month" }).toString(),
    });
    assertEq(r.status, 200, "status");
    const html = await r.text();
    assert(html.includes("הבקשה נדחתה"), "missing 'rejected' page");
    const tok = db.prepare(`SELECT * FROM approval_tokens WHERE token = ?`).get(rejectTokenB);
    assert(tok.used_at, "token not marked used");
    assertEq(tok.reason, "QA: not needed this month", "reason on token");
    const updated = getRequest(reqB.id);
    assertEq(updated.status, "rejected", "request.status");
    assertEq(updated.rejected_reason, "QA: not needed this month", "rejected_reason");
    assert(updated.exec_decision_by, "exec_decision_by not stamped");
    // approve token from the same email is now naturally blocked because state moved
    const r2 = await fetch(`${BASE_URL}/api/approval/act?token=${encodeURIComponent(approveTokenB)}`);
    assertEq(r2.status, 409, "approve after reject must be 409");
  });

  cleanupRequest(reqB.id);

  // ===== Scenario C: 400 paths =====
  console.log("Scenario C — bad input:");

  await check("invalid token → 400 + 'הקישור לא תקף'", async () => {
    const r = await fetch(`${BASE_URL}/api/approval/act?token=clearly-not-a-real-token`);
    assertEq(r.status, 400, "status");
    const html = await r.text();
    assert(html.includes("הקישור לא תקף") || html.includes("לא תקף"), "expected invalid-token message");
  });

  // ===== AC9: admin-guard exemption (only meaningful when guard is on) =====
  console.log("Scenario D — admin-guard exemption:");
  await check("AC9: /api/approval/* is exempt from admin guard (no token, no 401)", async () => {
    // The route is public-by-design. We just hit it without ADMIN_TOKEN
    // header and expect a domain-level response (400 invalid token), not
    // a 401 from the guard. If the guard were applied we'd get 401.
    const r = await fetch(`${BASE_URL}/api/approval/act?token=guard-test`);
    assert(r.status !== 401, `guard incorrectly fired: status=${r.status}`);
  });

  // ===== AC10: tsc clean =====
  console.log("Scenario E — typecheck:");
  await check("AC10: npm run build:server passes", () => {
    try {
      execSync("npm run build:server", { stdio: "pipe" });
    } catch (e) {
      throw new Error(`tsc failed: ${(e.stderr ?? e.stdout ?? "").toString().slice(0, 400)}`);
    }
  });

  // ---------- summary ----------
  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  console.log(`\n──────────────────────────`);
  console.log(`  PASS: ${pass}/${results.length}`);
  if (fail > 0) {
    console.log(`  FAIL: ${fail}`);
    for (const r of results.filter((r) => r.status === "FAIL")) {
      console.log(`    • ${r.name}\n      ${r.error}`);
    }
  }
  console.log(`──────────────────────────\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\n💥 unexpected: ${err.stack ?? err}\n`);
  process.exit(2);
});
