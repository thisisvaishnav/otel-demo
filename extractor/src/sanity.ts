import type { Component, ComponentClass, ModuleDep, RepoFilesData } from "@otel-demo/schema";
import { CLASS_NAMES } from "@otel-demo/schema";

export const MIN_COMPONENTS = 200;
export const MIN_MODULE_DEPS = 10;
export const MIN_PER_CLASS: Record<ComponentClass, number> = {
  receiver: 5,
  processor: 5,
  exporter: 5,
  extension: 5,
  connector: 5,
  scraper: 1,
};
export const MAX_FILE_BYTES = 500 * 1024;
export const MAX_TOTAL_BYTES = 2 * 1024 * 1024;

export interface FileInfo {
  name: string;
  bytes: number;
}

export function sanityComponents(components: Component[]): string[] {
  const violations: string[] = [];
  if (components.length < MIN_COMPONENTS) {
    violations.push(`expected >= ${MIN_COMPONENTS} components, got ${components.length}`);
  }
  for (const className of CLASS_NAMES) {
    const minimum = MIN_PER_CLASS[className];
    const count = components.filter((component) => component.class === className).length;
    if (count < minimum) {
      violations.push(`expected >= ${minimum} components in class "${className}", got ${count}`);
    }
  }
  const ids = new Set<string>();
  for (const component of components) {
    if (ids.has(component.id)) violations.push(`duplicate component id "${component.id}"`);
    ids.add(component.id);
  }
  return violations;
}

export function sanityFiles(files: FileInfo[]): string[] {
  const violations: string[] = [];
  let total = 0;
  for (const file of files) {
    total += file.bytes;
    if (file.bytes >= MAX_FILE_BYTES) {
      violations.push(`${file.name} is ${file.bytes} bytes (budget ${MAX_FILE_BYTES})`);
    }
  }
  if (total >= MAX_TOTAL_BYTES) {
    violations.push(`data total is ${total} bytes (budget ${MAX_TOTAL_BYTES})`);
  }
  return violations;
}

export function sanityRepo(moduledeps: ModuleDep[], repofiles: RepoFilesData): string[] {
  const violations: string[] = [];
  if (moduledeps.length < MIN_MODULE_DEPS) {
    violations.push(`expected >= ${MIN_MODULE_DEPS} module deps, got ${moduledeps.length}`);
  }
  const seen = new Set<string>();
  for (const dep of moduledeps) {
    if (seen.has(dep.path)) violations.push(`duplicate module path "${dep.path}"`);
    seen.add(dep.path);
  }
  if (repofiles.codeowners.length === 0) {
    violations.push("expected a non-empty CODEOWNERS rule list");
  }
  if (repofiles.distributions.length === 0) {
    violations.push("expected at least one distribution in distributions.yaml");
  }
  return violations;
}
