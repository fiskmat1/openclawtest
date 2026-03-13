import { z } from 'zod';

export const triggerAgentSupervisionSchema = z.object({
  teamId: z.uuid(),
  reason: z.string().trim().min(2).max(255).default('manual')
});

export type TriggerAgentSupervisionSchema = z.infer<
  typeof triggerAgentSupervisionSchema
>;
