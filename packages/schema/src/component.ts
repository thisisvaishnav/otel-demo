import { z } from "zod";

export const SCHEMA_VERSION = 1;

export const StabilityLevel = z.enum([
  "development",
  "alpha",
  "beta",
  "stable",
  "deprecated",
  "unmaintained",
]);
export type StabilityLevel = z.infer<typeof StabilityLevel>;

export const Signal = z.enum(["traces", "metrics", "logs", "profiles"]);
export type Signal = z.infer<typeof Signal>;

export const CLASS_NAMES = [
  "receiver",
  "processor",
  "exporter",
  "extension",
  "connector",
  "scraper",
] as const;

export const ComponentClass = z.enum(CLASS_NAMES);
export type ComponentClass = z.infer<typeof ComponentClass>;

export const Distribution = z.enum(["core", "contrib", "k8s"]);

export const Signals = z.object({
  traces: StabilityLevel.optional(),
  metrics: StabilityLevel.optional(),
  logs: StabilityLevel.optional(),
  profiles: StabilityLevel.optional(),
});
export type Signals = z.infer<typeof Signals>;

export const Codeowners = z.object({
  active: z.array(z.string()),
  emeritus: z.array(z.string()).default([]),
  seeking_new: z.boolean().default(false),
});
export type Codeowners = z.infer<typeof Codeowners>;

export const FeatureGate = z.object({
  id: z.string(),
  stage: StabilityLevel.optional(),
  description: z.string().optional(),
  from_version: z.string().optional(),
  reference_url: z.string().optional(),
});
export type FeatureGate = z.infer<typeof FeatureGate>;

export const StatusQuality = z.enum(["metadata", "unknown"]);
export type StatusQuality = z.infer<typeof StatusQuality>;

export const Component = z.object({
  id: z.string(),
  class: ComponentClass,
  type: z.string(),
  display_name: z.string(),
  description: z.string(),
  signals: Signals,
  distributions: z.array(Distribution),
  codeowners: Codeowners,
  feature_gates: z.array(FeatureGate),
  source_url: z.string(),
  status_quality: StatusQuality,
});
export type Component = z.infer<typeof Component>;

export const ComponentsData = z.object({
  components: z.array(Component),
});
export type ComponentsData = z.infer<typeof ComponentsData>;

export const Meta = z.object({
  contrib_sha: z.string().regex(/^[0-9a-f]{40}$/),
  schema_version: z.number().int().nonnegative(),
});
export type Meta = z.infer<typeof Meta>;
