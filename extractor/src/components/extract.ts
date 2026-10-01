import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Component } from "@otel-demo/schema";
import { CLASS_NAMES } from "@otel-demo/schema";
import { fallbackComponent, parseMetadata } from "./parse";

export interface ExtractResult {
  components: Component[];
  warnings: string[];
}

export function extractComponents(repoDir: string): ExtractResult {
  const warnings: string[] = [];
  const warn = (message: string) => warnings.push(message);
  const components: Component[] = [];

  for (const className of CLASS_NAMES) {
    const classDir = join(repoDir, className);
    if (!existsSync(classDir)) continue;
    for (const dirName of readdirSync(classDir).sort()) {
      const componentDir = join(classDir, dirName);
      if (!statSync(componentDir).isDirectory()) continue;
      const id = `${className}/${dirName}`;
      const metadataPath = join(componentDir, "metadata.yaml");
      let component: Component | null = null;
      if (existsSync(metadataPath)) {
        component = parseMetadata(readFileSync(metadataPath, "utf8"), id, className, warn);
        if (component === null) {
          warn(`${id}: emitted with status_quality "unknown" (metadata unusable)`);
        }
      } else {
        warn(`${id}: no metadata.yaml; emitted with status_quality "unknown"`);
      }
      components.push(component ?? fallbackComponent(id, className));
    }
  }

  components.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { components, warnings };
}
