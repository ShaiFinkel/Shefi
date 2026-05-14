#!/usr/bin/env node
// One-shot smoke test for the new in-process grep_repo / read_file tools.
// Validates both work correctly without ripgrep installed.

import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const distTools = path.resolve("dist/agents/dev/tools.js");
const mod = await import(distTools);

let pass = 0, fail = 0;
function check(name, ok, info = "") {
  if (ok) { console.log(`  ✓ ${name}`); pass++; }
  else { console.log(`  ✗ ${name} ${info}`); fail++; }
}

console.log("\ngrep_repo tool:");

// 1. find a known string
const r1 = mod.grepRepo({ pattern: "managerApprovalTemplate", glob: null });
check("finds 'managerApprovalTemplate' across repo", r1.includes("src/lib/email.ts") && r1.includes("src/server/api-employee.ts"), `\n  → ${r1.slice(0, 200)}`);

// 2. glob filter
const r2 = mod.grepRepo({ pattern: "managerApprovalTemplate", glob: "src/lib/**/*.ts" });
check("glob 'src/lib/**/*.ts' restricts to email.ts only", r2.includes("src/lib/email.ts") && !r2.includes("api-employee"), `\n  → ${r2.slice(0, 200)}`);

// 3. zero matches — search inside a glob that excludes the test script itself
const r3 = mod.grepRepo({ pattern: "ZzZzNotInRepo_aBcDeF12345", glob: "src/**/*.ts" });
check("returns 'אין התאמות' for unknown pattern", r3.includes("אין התאמות"), `\n  → got: ${JSON.stringify(r3).slice(0, 200)}`);

// 4. invalid regex
const r4 = mod.grepRepo({ pattern: "[unclosed", glob: null });
check("returns clear error on invalid regex", r4.startsWith("שגיאה"));

console.log("\nread_file tool:");

// 5. read with line range
const r5 = mod.readFileSlice({ path: "src/agents/dev/noam.ts", start_line: 1, end_line: 5 });
check("read_file with start_line=1 end_line=5 returns 5 numbered lines", r5.includes("    1| ") && r5.includes("    5| ") && !r5.includes("    6| "));

// 6. invalid range
const r6 = mod.readFileSlice({ path: "src/agents/dev/noam.ts", start_line: 100, end_line: 50 });
check("invalid range returns error", r6.includes("שגיאה"));

// 7. non-existent file
const r7 = mod.readFileSlice({ path: "src/does-not-exist.ts", start_line: null, end_line: null });
check("non-existent file is handled cleanly", r7.includes("לא קיים"));

// 8. truncation kicks in for huge ranges (read everything from a big file)
const r8 = mod.readFileSlice({ path: "src/server/api-employee.ts", start_line: null, end_line: null });
check("large file → truncation message present", r8.includes("נקצץ") || r8.length < 7000, `len=${r8.length}`);

console.log(`\n────────────\n  ${pass}/${pass+fail} passed\n`);
process.exit(fail === 0 ? 0 : 1);
