import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Component, ModuleDep, RepoFilesData } from "@otel-demo/schema";
import {
  ComponentsData,
  Meta,
  ModuleDeps,
  RepoFilesData as RepoFilesDataSchema,
  Workflow,
} from "@otel-demo/schema";
import { missingWorkflowAnchors } from "./repo/extract";
import { type FileInfo, sanityComponents, sanityFiles, sanityRepo } from "./sanity";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const DATA_DIR = join(ROOT, "atlas", "public", "data");
const WORKFLOW_PATH = join(ROOT, "content", "workflow.json");

type Validator = (text: string) => unknown;

const VALIDATORS: Record<string, Validator> = {
  "components.json": (text) => ComponentsData.parse(JSON.parse(text)),
  "meta.json": (text) => Meta.parse(JSON.parse(text)),
  "moduledeps.json": (text) => ModuleDeps.parse(JSON.parse(text)),
  "repofiles.json": (text) => RepoFilesDataSchema.parse(JSON.parse(text)),
};

const REQUIRED_FILES = ["moduledeps.json", "repofiles.json"];

function workflowAnchorViolations(repofiles: RepoFilesData): string[] {
  let anchors: string[];
  try {
    const workflow = Workflow.parse(JSON.parse(readFileSync(WORKFLOW_PATH, "utf8")));
    anchors = workflow.steps.map((step) => step.file_anchor);
  } catch (error) {
    return [`content/workflow.json: ${error instanceof Error ? error.message : String(error)}`];
  }
  return missingWorkflowAnchors(repofiles.files, anchors).map(
    (anchor) => `repofiles.json has no entry for workflow file_anchor "${anchor}"`,
  );
}

export function validateData(dataDir = DATA_DIR): string[] {
  const violations: string[] = [];
  const files: FileInfo[] = [];
  let components: Component[] = [];
  let moduledeps: ModuleDep[] | null = null;
  let repofiles: RepoFilesData | null = null;

  for (const name of readdirSync(dataDir).sort()) {
    const path = join(dataDir, name);
    if (!statSync(path).isFile()) continue;
    const bytes = statSync(path).size;
    files.push({ name, bytes });
    if (!name.endsWith(".json")) continue;
    const validator = VALIDATORS[name];
    if (!validator) {
      violations.push(`${name}: no schema registered in validate.ts`);
      continue;
    }
    try {
      const parsed = validator(readFileSync(path, "utf8"));
      if (name === "moduledeps.json") moduledeps = parsed as ModuleDep[];
      else if (name === "repofiles.json") repofiles = parsed as RepoFilesData;
      else if (parsed !== null && typeof parsed === "object" && "components" in parsed) {
        components = (parsed as { components: Component[] }).components;
      }
    } catch (error) {
      violations.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (files.length === 0) violations.push("no data files found; run `npm run extract` first");
  for (const required of REQUIRED_FILES) {
    if (!files.some((file) => file.name === required)) {
      violations.push(`${required} missing; run \`npm run extract\``);
    }
  }
  violations.push(...sanityComponents(components));
  violations.push(...sanityFiles(files));
  if (moduledeps !== null && repofiles !== null) {
    violations.push(...sanityRepo(moduledeps, repofiles));
    violations.push(...workflowAnchorViolations(repofiles));
  }
  return violations;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  const violations = validateData();
  if (violations.length > 0) {
    for (const violation of violations) console.error(`FAIL: ${violation}`);
    process.exit(1);
  }
  console.log("validate:data OK");
}
