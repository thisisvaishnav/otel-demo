import { z } from "zod";
import { ContribPath } from "./content";

export const RepoFileKind = z.enum(["file", "dir"]);
export type RepoFileKind = z.infer<typeof RepoFileKind>;

export const ModuleDep = z.object({
  path: z.string(),
  module: z.string().min(1),
  requires: z.array(z.string().min(1)),
  components: z.array(z.string().min(1)),
});
export type ModuleDep = z.infer<typeof ModuleDep>;

/** `atlas/public/data/moduledeps.json` — a bare array, ordered by `path`. */
export const ModuleDeps = z.array(ModuleDep);

export const RepoFile = z.object({
  kind: RepoFileKind,
  title: z.string().min(1).optional(),
  headings: z.array(z.string().min(1)).default([]),
  owners: z.array(z.string().min(1)).default([]),
});
export type RepoFile = z.infer<typeof RepoFile>;

export const CodeownersRule = z.object({
  pattern: z.string().min(1),
  owners: z.array(z.string().min(1)).min(1),
});
export type CodeownersRule = z.infer<typeof CodeownersRule>;

export const DistributionInfo = z.object({
  name: z.string().min(1),
  url: z.string().url(),
});
export type DistributionInfo = z.infer<typeof DistributionInfo>;

/** `atlas/public/data/repofiles.json` — the contributor-surface map of the repo. */
export const RepoFilesData = z.object({
  files: z.record(ContribPath, RepoFile),
  codeowners: z.array(CodeownersRule).min(1),
  distributions: z.array(DistributionInfo).min(1),
});
export type RepoFilesData = z.infer<typeof RepoFilesData>;
