import type {
  AgentRole,
  AgentTeamStatus,
  AgentTeamTemplate
} from '@workspace/database';
import type { AgentAutonomyLevel } from '@workspace/agents/templates';

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
  mission?: string;
  operatingDomains: string[];
  autonomyLevel?: AgentAutonomyLevel;
  telegramEnabled: boolean;
  browserEnabled: boolean;
  runtimeCount: number;
  agentCount: number;
  pendingApprovalCount: number;
  latestDeploymentStatus?: string;
  primaryRoles: AgentRole[];
};
