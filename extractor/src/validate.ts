import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Component } from "@otel-demo/schema";
import { ComponentsData, Meta } from "@otel-demo/schema";
import { type FileInfo, sanityComponents, sanityFiles } from "./sanity";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const DATA_DIR = join(ROOT, "atlas", "public", "data");

type Validator = (text: string) => unknown;

const VALIDATORS: Record<string, Validator> = {
  "components.json": (text) => ComponentsData.parse(JSON.parse(text)),
  "meta.json": (text) => Meta.parse(JSON.parse(text)),
};

export function validateData(dataDir = DATA_DIR): string[] {
  const violations: string[] = [];
  const files: FileInfo[] = [];
  let components: Component[] = [];

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
      if (parsed !== null && typeof parsed === "object" && "components" in parsed) {
        components = (parsed as { components: Component[] }).components;
      }
    } catch (error) {
      violations.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (files.length === 0) violations.push("no data files found; run `npm run extract` first");
  violations.push(...sanityComponents(components));
  violations.push(...sanityFiles(files));
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
