import { z } from "zod";

export const ModuleDep = z.object({ module: z.string() });
export type ModuleDep = z.infer<typeof ModuleDep>;

export const RepoFile = z.object({ path: z.string() });
export type RepoFile = z.infer<typeof RepoFile>;
