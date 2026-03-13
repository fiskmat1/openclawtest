import type {
  AgentArtifactType,
  AgentRunStatus,
  AgentRunTrigger
} from '@workspace/database';

export type AgentRunDto = {
  id: string;
  teamId: string;
  teamName: string;
  status: AgentRunStatus;
  trigger: AgentRunTrigger;
  title?: string;
  summary?: string;
  objective?: string;
  artifactTypes: AgentArtifactType[];
  stepCount: number;
  approvalCount: number;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
};
