import { z } from "zod";

export const Component = z.object({ id: z.string() });
export type Component = z.infer<typeof Component>;
