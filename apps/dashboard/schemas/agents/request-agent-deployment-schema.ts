import { z } from 'zod';

import { AgentRuntimeProvider } from '@workspace/database';

export const requestAgentDeploymentSchema = z.object({
  teamId: z.uuid(),
  provider: z.enum(AgentRuntimeProvider).default(AgentRuntimeProvider.E2B),
  providerConnectionId: z.uuid().optional()
});

export type RequestAgentDeploymentSchema = z.infer<
  typeof requestAgentDeploymentSchema
>;
