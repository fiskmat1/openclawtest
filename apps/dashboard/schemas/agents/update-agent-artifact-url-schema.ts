import { z } from 'zod';

export const updateAgentArtifactUrlSchema = z.object({
  artifactId: z.uuid(),
  url: z.url().min(1)
});

export type UpdateAgentArtifactUrlSchema = z.infer<
  typeof updateAgentArtifactUrlSchema
>;
