import type {
  AgentRole,
  AgentTeamStatus,
  AgentTeamTemplate
} from '@workspace/database';

export type AgentTeamDto = {
  id: string;
  name: string;
  slug: string;
  template: AgentTeamTemplate;
  status: AgentTeamStatus;
  description?: string;
  desiredOutcome?: string;
  cadenceCron?: string;
  lastRunAt?: Date;
  nextRunAt?: Date;
  runtimeCount: number;
  agentCount: number;
  pendingApprovalCount: number;
  latestDeploymentStatus?: string;
  primaryRoles: AgentRole[];
};
