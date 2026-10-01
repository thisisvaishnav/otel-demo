import type { Component, ComponentClass, FeatureGate } from "@otel-demo/schema";
import { Component as ComponentSchema, Distribution } from "@otel-demo/schema";
import { parse } from "yaml";
import { deriveSignals } from "./signals";

const SOURCE_ROOT = "https://github.com/open-telemetry/opentelemetry-collector-contrib";

export function sourceUrl(id: string): string {
  return `${SOURCE_ROOT}/tree/main/${id}`;
}

export function fallbackComponent(id: string, className: ComponentClass): Component {
  const dirName = id.slice(id.indexOf("/") + 1);
  const type = dirName.endsWith(className) ? dirName.slice(0, -className.length) : dirName;
  return {
    id,
    class: className,
    type,
    display_name: dirName,
    description: "",
    signals: {},
    distributions: [],
    codeowners: { active: [], emeritus: [], seeking_new: false },
    feature_gates: [],
    source_url: sourceUrl(id),
    status_quality: "unknown",
  };
}

function firstParagraph(text: string): string {
  const [paragraph = ""] = text.split(/\n\s*\n/);
  return paragraph.replace(/\s+/g, " ").trim();
}

function trimDescription(text: string, max = 600): string {
  const paragraph = firstParagraph(text);
  if (paragraph.length <= max) return paragraph;
  const cut = paragraph.slice(0, max);
  const boundary = cut.lastIndexOf(" ");
  return `${cut.slice(0, boundary > max * 0.6 ? boundary : max)}…`;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function readFeatureGates(value: unknown): FeatureGate[] {
  if (!Array.isArray(value)) return [];
  const gates: FeatureGate[] = [];
  for (const entry of value) {
    if (entry === null || typeof entry !== "object") continue;
    const raw = entry as Record<string, unknown>;
    if (typeof raw.id !== "string") continue;
    const gate: FeatureGate = { id: raw.id };
    if (typeof raw.stage === "string") gate.stage = raw.stage as FeatureGate["stage"];
    if (typeof raw.description === "string") gate.description = raw.description;
    if (typeof raw.from_version === "string") gate.from_version = raw.from_version;
    if (typeof raw.reference_url === "string") gate.reference_url = raw.reference_url;
    gates.push(gate);
  }
  return gates;
}

export function parseMetadata(
  yamlText: string,
  id: string,
  className: ComponentClass,
  warn: (message: string) => void,
): Component | null {
  let raw: unknown;
  try {
    raw = parse(yamlText);
  } catch (error) {
    warn(
      `${id}: malformed metadata.yaml (${error instanceof Error ? error.message : String(error)})`,
    );
    return null;
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    warn(`${id}: metadata.yaml is not a mapping`);
    return null;
  }
  const doc = raw as Record<string, unknown>;
  const status = (
    doc.status !== null && typeof doc.status === "object" && !Array.isArray(doc.status)
      ? doc.status
      : {}
  ) as Record<string, unknown>;
  const codeowners = (
    status.codeowners !== null &&
    typeof status.codeowners === "object" &&
    !Array.isArray(status.codeowners)
      ? status.codeowners
      : {}
  ) as Record<string, unknown>;

  const rawDistributions = asStringArray(status.distributions);
  const distributions = rawDistributions.filter(
    (entry): entry is "core" | "contrib" | "k8s" => Distribution.safeParse(entry).success,
  );
  for (const entry of rawDistributions) {
    if (!distributions.includes(entry as "core" | "contrib" | "k8s")) {
      warn(`${id}: unknown distribution "${entry}"; dropped from distributions list`);
    }
  }

  const metadataClass = typeof status.class === "string" ? status.class : undefined;
  const candidate = {
    id,
    class: metadataClass === className ? metadataClass : className,
    type: typeof doc.type === "string" ? doc.type : "",
    display_name:
      typeof doc.display_name === "string" ? doc.display_name : id.slice(id.indexOf("/") + 1),
    description: typeof doc.description === "string" ? trimDescription(doc.description) : "",
    signals: deriveSignals(status.stability, (message) => warn(`${id}: ${message}`)),
    distributions,
    codeowners: {
      active: asStringArray(codeowners.active),
      emeritus: asStringArray(codeowners.emeritus),
      seeking_new: codeowners.seeking_new === true,
    },
    feature_gates: readFeatureGates(doc.feature_gates),
    source_url: sourceUrl(id),
    status_quality: "metadata",
  };

  const parsed = ComponentSchema.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      warn(`${id}: schema issue at ${issue.path.join(".")}: ${issue.message}`);
    }
    return null;
  }
  return parsed.data;
}
