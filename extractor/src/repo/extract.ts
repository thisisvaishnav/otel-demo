import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import type { CodeownersRule, ModuleDep, RepoFile, RepoFilesData } from "@otel-demo/schema";
import { DistributionInfo } from "@otel-demo/schema";
import { parse } from "yaml";
import { parseCodeowners, resolveOwners } from "./codeowners";
import { parseGoMod } from "./gomod";

const HEADING_DIRS = ["docs", ".chloggen"];
const HEADING_FILES = ["CONTRIBUTING.md", "issue-triaging.md"];

export interface RepoExtractResult {
  modules: ModuleDep[];
  repofiles: RepoFilesData;
  warnings: string[];
}

type Warn = (message: string) => void;

function byName(a: { name: string }, b: { name: string }): number {
  if (a.name < b.name) return -1;
  return a.name > b.name ? 1 : 0;
}

function toPosix(path: string): string {
  return path.split(sep).join("/");
}

export function markdownHeadings(text: string): string[] {
  const headings: string[] = [];
  let fence: string | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.trimStart();
    const marker = /^(`{3,}|~{3,})/.exec(line);
    if (marker !== null) {
      if (fence === null) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading === null) continue;
    const value = heading[1].replace(/\s+#+\s*$/, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
    if (value.trim() !== "") headings.push(value.trim());
  }
  return headings;
}

function findGoModDirs(repoDir: string): string[] {
  const dirs: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === ".git") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "go.mod") dirs.push(dirname(full));
    }
  };
  walk(repoDir);
  return dirs;
}

function ownerModule(entries: ModuleDep[], id: string): ModuleDep | null {
  let best: ModuleDep | null = null;
  for (const entry of entries) {
    const matches = entry.path === "" || entry.path === id || id.startsWith(`${entry.path}/`);
    if (!matches) continue;
    if (best === null || entry.path.length > best.path.length) best = entry;
  }
  return best;
}

export function extractModules(repoDir: string, componentIds: string[], warn: Warn): ModuleDep[] {
  const entries: ModuleDep[] = [];
  for (const dir of findGoModDirs(repoDir)) {
    const path = toPosix(relative(repoDir, dir));
    const parsed = parseGoMod(readFileSync(join(dir, "go.mod"), "utf8"));
    if (parsed === null) {
      warn(`${path === "" ? "." : path}: go.mod has no module directive; skipped`);
      continue;
    }
    entries.push({ path, module: parsed.module, requires: parsed.requires, components: [] });
  }
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const known = new Set(entries.map((entry) => entry.module));
  const dangling = new Set<string>();
  for (const entry of entries) {
    for (const required of entry.requires) {
      if (!known.has(required)) dangling.add(required);
    }
  }
  for (const required of [...dangling].sort()) {
    warn(`required module has no go.mod in the tree: ${required}`);
  }

  for (const id of [...componentIds].sort()) {
    const owner = ownerModule(entries, id);
    if (owner === null) warn(`component ${id} is not covered by any Go module`);
    else owner.components.push(id);
  }
  return entries;
}

function addMarkdown(files: Record<string, RepoFile>, key: string, path: string): void {
  const headings = markdownHeadings(readFileSync(path, "utf8"));
  const existing = files[key] ?? { kind: "file" as const, headings: [], owners: [] };
  files[key] = { ...existing, title: headings[0], headings };
}

function readDistributions(repoDir: string, warn: Warn): RepoFilesData["distributions"] {
  const path = join(repoDir, "distributions.yaml");
  if (!existsSync(path)) {
    warn("missing distributions.yaml in the checkout");
    return [];
  }
  const parsed: unknown = parse(readFileSync(path, "utf8"));
  if (!Array.isArray(parsed)) {
    warn("distributions.yaml is not a list");
    return [];
  }
  const distributions: RepoFilesData["distributions"] = [];
  for (const entry of parsed) {
    const result = DistributionInfo.safeParse(entry);
    if (result.success) distributions.push(result.data);
    else
      warn(`distributions.yaml: unusable entry (${result.error.issues[0]?.message ?? "invalid"})`);
  }
  return distributions;
}

function readCodeowners(repoDir: string, warn: Warn): CodeownersRule[] {
  const path = join(repoDir, ".github", "CODEOWNERS");
  if (!existsSync(path)) {
    warn("missing .github/CODEOWNERS in the checkout");
    return [];
  }
  const rules = parseCodeowners(readFileSync(path, "utf8"));
  if (rules.length === 0) warn(".github/CODEOWNERS produced no owner rules");
  return rules;
}

export function extractRepoFiles(repoDir: string, warn: Warn): RepoFilesData {
  const files: Record<string, RepoFile> = {};

  for (const entry of readdirSync(repoDir, { withFileTypes: true }).sort(byName)) {
    if (entry.name === ".git") continue;
    const kind = entry.isDirectory() ? ("dir" as const) : ("file" as const);
    files[`${entry.name}${kind === "dir" ? "/" : ""}`] = { kind, headings: [], owners: [] };
  }

  for (const dir of HEADING_DIRS) {
    const full = join(repoDir, dir);
    if (!existsSync(full)) {
      warn(`missing ${dir}/ in the checkout`);
      continue;
    }
    for (const entry of readdirSync(full, { withFileTypes: true }).sort(byName)) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      addMarkdown(files, `${dir}/${entry.name}`, join(full, entry.name));
    }
  }

  for (const name of HEADING_FILES) {
    const full = join(repoDir, name);
    if (!existsSync(full)) {
      warn(`missing ${name} in the checkout`);
      continue;
    }
    addMarkdown(files, name, full);
  }

  const github = join(repoDir, ".github");
  if (!existsSync(github)) {
    warn("missing .github/ in the checkout");
  } else {
    for (const entry of readdirSync(github, { withFileTypes: true }).sort(byName)) {
      const kind = entry.isDirectory() ? ("dir" as const) : ("file" as const);
      files[`.github/${entry.name}${kind === "dir" ? "/" : ""}`] = {
        kind,
        headings: [],
        owners: [],
      };
    }
  }

  const codeowners = readCodeowners(repoDir, warn);
  for (const key of Object.keys(files)) {
    files[key] = { ...files[key], owners: resolveOwners(codeowners, key) };
  }

  return { files, codeowners, distributions: readDistributions(repoDir, warn) };
}

export function extractRepo(repoDir: string, componentIds: string[]): RepoExtractResult {
  const warnings: string[] = [];
  const warn: Warn = (message) => warnings.push(message);
  return {
    modules: extractModules(repoDir, componentIds, warn),
    repofiles: extractRepoFiles(repoDir, warn),
    warnings,
  };
}

export function missingWorkflowAnchors(files: RepoFilesData["files"], anchors: string[]): string[] {
  return anchors.filter((anchor) => !(anchor in files));
}
