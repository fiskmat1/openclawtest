import { z } from 'zod';

import { AgentTeamTemplate } from '@workspace/database';

export const createAgentTeamSchema = z.object({
  name: z.string().trim().min(2).max(255),
  template: z.enum(AgentTeamTemplate),
  description: z.string().trim().max(2000).optional(),
  desiredOutcome: z.string().trim().max(8000).optional(),
  cadenceCron: z.string().trim().max(255).optional()
});

export type CreateAgentTeamSchema = z.infer<typeof createAgentTeamSchema>;
