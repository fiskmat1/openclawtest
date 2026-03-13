import type { AgentArtifactType } from '@workspace/database';

export type AgentArtifactDto = {
  id: string;
  runId?: string;
  teamId?: string;
  title: string;
  type: AgentArtifactType;
  url?: string;
  textContent?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
};
