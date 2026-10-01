import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export const REPO_URL = "https://github.com/open-telemetry/opentelemetry-collector-contrib.git";

export const SPARSE_PATHS = [
  "receiver",
  "processor",
  "exporter",
  "extension",
  "connector",
  "scraper",
  ".github",
  "docs",
];

function git(args: string[], cwd?: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

export function ensureClone(cacheDir: string): { dir: string; sha: string } {
  const dir = join(cacheDir, "contrib");
  if (!existsSync(join(dir, ".git"))) {
    mkdirSync(cacheDir, { recursive: true });
    git(["clone", "--depth", "1", "--filter=blob:none", "--sparse", REPO_URL, dir]);
    git(["sparse-checkout", "set", ...SPARSE_PATHS], dir);
  }
  return { dir, sha: git(["rev-parse", "HEAD"], dir) };
}
