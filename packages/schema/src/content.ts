import { z } from "zod";

export const CONTENT_SCHEMA_VERSION = 1;

/** Minimum number of glossary terms Step 3 must ship (plans/otel-contrib-atlas.md §6). */
export const GLOSSARY_MIN_TERMS = 30;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ANCHOR = /^(?:view|region)\.[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REL_PATH = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*\/?$/;
const ROUTE = /^#\/[a-z0-9-]+$/;

export const Slug = z.string().regex(SLUG);

/** Id of a place in the atlas: registered in `content/regions.json` as `view.*` or `region.*`. */
export const AnchorId = z.string().regex(ANCHOR);

/** Path relative to the contrib repo root. Directories keep their trailing slash. */
export const ContribPath = z.string().regex(REL_PATH);

const REPO = "https://github.com/open-telemetry/opentelemetry-collector-contrib";

/** Canonical GitHub URL for a contrib path (directory -> tree, file -> blob). */
export function contribUrl(path: string): string {
  const dir = path.endsWith("/");
  return `${REPO}/${dir ? "tree" : "blob"}/main/${path.replace(/\/$/, "")}`;
}

export const View = z.object({
  id: AnchorId,
  route: z.string().regex(ROUTE),
  label: z.string().min(1),
  summary: z.string().min(10),
});
export type View = z.infer<typeof View>;

export const REGION_KINDS = ["component-class", "dir", "file", "concept"] as const;
export const RegionKind = z.enum(REGION_KINDS);
export type RegionKind = z.infer<typeof RegionKind>;

export const Region = z
  .object({
    id: AnchorId,
    kind: RegionKind,
    label: z.string().min(1),
    summary: z.string().min(10),
    view: AnchorId.optional(),
    path: ContribPath.optional(),
  })
  .refine((region) => (region.kind === "concept" ? !region.path : Boolean(region.path)), {
    message: "concept regions carry no path; component-class/dir/file regions require one",
    path: ["path"],
  })
  .refine(
    (region) => region.path === undefined || region.kind === "file" || region.path.endsWith("/"),
    { message: "component-class and dir region paths end with /", path: ["path"] },
  )
  .refine(
    (region) => region.path === undefined || region.kind !== "file" || !region.path.endsWith("/"),
    { message: "file region paths must not end with /", path: ["path"] },
  );
export type Region = z.infer<typeof Region>;

/** `content/regions.json` — the canonical registry of every anchor id in the atlas. */
export const Regions = z.object({
  schema_version: z.number().int().positive(),
  views: z.array(View).min(1),
  regions: z.array(Region).min(1),
});
export type Regions = z.infer<typeof Regions>;

/** Every anchor id that glossary / workflow / architecture / starter content may reference. */
export function anchorIds(data: Regions): Set<string> {
  return new Set([...data.views, ...data.regions].map((entry) => entry.id));
}

export const GlossaryTerm = z.object({
  id: Slug,
  term: z.string().min(1),
  definition: z.string().min(40),
  anchor: AnchorId,
  source: z.object({
    path: ContribPath,
    label: z.string().min(1).optional(),
  }),
  aliases: z.array(z.string().min(1)).default([]),
  related: z.array(Slug).default([]),
});
export type GlossaryTerm = z.infer<typeof GlossaryTerm>;

export const Glossary = z.object({
  schema_version: z.number().int().positive(),
  terms: z.array(GlossaryTerm).min(GLOSSARY_MIN_TERMS),
});
export type Glossary = z.infer<typeof Glossary>;

export const WorkflowStep = z.object({
  id: Slug,
  order: z.number().int().positive(),
  title: z.string().min(1),
  summary: z.string().min(40),
  anchor: AnchorId,
  file_anchor: ContribPath,
  command: z.string().min(1).optional(),
});
export type WorkflowStep = z.infer<typeof WorkflowStep>;

export const Workflow = z.object({
  schema_version: z.number().int().positive(),
  steps: z.array(WorkflowStep).min(1),
});
export type Workflow = z.infer<typeof Workflow>;

export const ArchRegion = z.object({
  anchor: AnchorId,
  title: z.string().min(1),
  narrative: z.string().min(80),
  paths: z.array(ContribPath).default([]),
  commands: z.array(z.string().min(1)).default([]),
  related_terms: z.array(Slug).default([]),
  workflow_steps: z.array(Slug).default([]),
});
export type ArchRegion = z.infer<typeof ArchRegion>;

export const Architecture = z.object({
  schema_version: z.number().int().positive(),
  regions: z.array(ArchRegion).min(1),
});
export type Architecture = z.infer<typeof Architecture>;

export const StarterIssue = z.discriminatedUnion("kind", [
  z.object({
    id: Slug,
    kind: z.literal("component"),
    label: z.string().min(1),
    component_id: z.string().min(1),
    reason: z.string().min(20),
    anchor: AnchorId,
  }),
  z.object({
    id: Slug,
    kind: z.literal("issue"),
    label: z.string().min(1),
    issue_url: z.url(),
    reason: z.string().min(20),
    anchor: AnchorId,
  }),
]);
export type StarterIssue = z.infer<typeof StarterIssue>;

export const StarterIssues = z.object({
  schema_version: z.number().int().positive(),
  issues: z.array(StarterIssue).min(1),
});
export type StarterIssues = z.infer<typeof StarterIssues>;
