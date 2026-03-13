import type {
  AgentDeploymentStatus,
  AgentRuntimeProvider
} from '@workspace/database';

export type AgentDeploymentDto = {
  id: string;
  teamId: string;
  teamName: string;
  provider: AgentRuntimeProvider;
  status: AgentDeploymentStatus;
  runtimeName?: string;
  externalDeploymentId?: string;
  controlUrl?: string;
  region?: string;
  failureReason?: string;
  createdAt: Date;
  completedAt?: Date;
};
