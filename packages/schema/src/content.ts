import { z } from "zod";

export const GlossaryTerm = z.object({ id: z.string() });
export type GlossaryTerm = z.infer<typeof GlossaryTerm>;

export const WorkflowStep = z.object({ id: z.string() });
export type WorkflowStep = z.infer<typeof WorkflowStep>;

export const ArchRegion = z.object({ id: z.string() });
export type ArchRegion = z.infer<typeof ArchRegion>;

export const Regions = z.record(z.string(), z.unknown());
export type Regions = z.infer<typeof Regions>;

export const StarterIssue = z.object({ id: z.string() });
export type StarterIssue = z.infer<typeof StarterIssue>;
