import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Meta } from "@otel-demo/schema";
import { CLASS_NAMES, ComponentsData, Meta as MetaSchema, SCHEMA_VERSION } from "@otel-demo/schema";
import { ensureClone } from "./clone";
import { extractComponents } from "./components/extract";
import { stableStringify } from "./lib/json";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const DATA_DIR = join(ROOT, "atlas", "public", "data");
const CACHE_DIR = join(ROOT, ".extractor-cache");

function main(): void {
  const { dir, sha } = ensureClone(CACHE_DIR);
  const { components, warnings } = extractComponents(dir);
  for (const warning of warnings) console.warn(`warn: ${warning}`);

  const data = ComponentsData.parse({ components });
  const meta: Meta = { contrib_sha: sha, schema_version: SCHEMA_VERSION };
  MetaSchema.parse(meta);

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(join(DATA_DIR, "components.json"), stableStringify(data));
  writeFileSync(join(DATA_DIR, "meta.json"), stableStringify(meta));

  const summary = CLASS_NAMES.map(
    (className) => `${className}=${data.components.filter((c) => c.class === className).length}`,
  ).join(" ");
  const unknown = data.components.filter((c) => c.status_quality === "unknown").length;
  console.log(
    `contrib ${sha.slice(0, 12)}: ${data.components.length} components (${summary}), unknown=${unknown}`,
  );
  console.log(`warnings: ${warnings.length}`);
}

main();
