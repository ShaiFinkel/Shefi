import { simpleGit, type SimpleGit } from "simple-git";
import { resolve } from "node:path";

const REPO_ROOT = resolve(process.cwd());
export const git: SimpleGit = simpleGit({ baseDir: REPO_ROOT });

const PROTECTED_PATHS = [".env", "node_modules", "dist", "data", ".git"];

export function isPathSafe(relPath: string): boolean {
  if (relPath.startsWith("/") || relPath.includes("..")) return false;
  return !PROTECTED_PATHS.some(
    (p) => relPath === p || relPath.startsWith(p + "/"),
  );
}

export async function ensureCleanMain(): Promise<void> {
  const status = await git.status();
  if (status.current !== "main") {
    await git.checkout("main");
  }
}

export async function createFeatureBranch(devTaskId: number): Promise<string> {
  const branch = `feat/${devTaskId}-${Date.now()}`;
  await ensureCleanMain();
  await git.checkoutLocalBranch(branch);
  return branch;
}

export async function commitOnBranch(
  branch: string,
  message: string,
): Promise<void> {
  const status = await git.status();
  if (status.current !== branch) {
    await git.checkout(branch);
  }
  await git.add(".");
  await git.commit(message, undefined, { "--allow-empty": null });
}

export async function getDiffAgainstMain(branch: string): Promise<string> {
  return git.diff(["main", branch]);
}

export async function mergeProposalBranch(branch: string): Promise<void> {
  await git.checkout("main");
  await git.merge([branch, "--no-ff", "-m", `merge ${branch} via dashboard approval`]);
  try {
    await git.deleteLocalBranch(branch, true);
  } catch {
    // ignore — keep the branch around if delete fails
  }
}

export async function abortBranch(branch: string): Promise<void> {
  try {
    await git.checkout("main");
    await git.deleteLocalBranch(branch, true);
  } catch {
    // ignore
  }
}
