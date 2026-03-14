import { z } from 'zod';

import { AgentTeamTemplate } from '@workspace/database';
import type { AgentAutonomyLevel } from '@workspace/agents/templates';

const autonomyLevels = [
  'supervised',
  'guarded-autonomous',
  'autonomous'
] as const satisfies readonly AgentAutonomyLevel[];

export const createAgentTeamSchema = z.object({
  name: z.string().trim().min(2).max(255),
  template: z.enum(AgentTeamTemplate).optional(),
  description: z.string().trim().max(2000).optional(),
  mission: z.string().trim().min(10).max(4000),
  desiredOutcome: z.string().trim().max(8000).optional(),
  operatingDomainsText: z.string().trim().max(4000).optional(),
  agentRoleHintsText: z.string().trim().max(4000).optional(),
  autonomyLevel: z.enum(autonomyLevels).default('guarded-autonomous'),
  cadenceCron: z.string().trim().max(255).optional(),
  telegramEnabled: z.boolean().default(true),
  browserEnabled: z.boolean().default(true),
  accountTargetsText: z.string().trim().max(4000).optional(),
  allowedDomainsText: z.string().trim().max(4000).optional(),
  operatorInstructions: z.string().trim().max(4000).optional()
});

export type CreateAgentTeamSchema = z.infer<typeof createAgentTeamSchema>;
