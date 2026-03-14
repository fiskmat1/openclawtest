import {
  AgentControlChannelStatus,
  AgentControlChannelType,
  AgentDeploymentStatus,
  AgentRole,
  AgentRunStatus,
  AgentRuntimeProvider,
  AgentRuntimeStatus,
  AgentTeamStatus,
  AgentTeamTemplate,
  ApprovalRequestStatus,
  ApprovalRiskLevel,
  BrowserProfileStatus,
  ProviderConnectionStatus,
  ProviderConnectionType
} from '@workspace/database';

export const agentTeamTemplateLabels: Record<AgentTeamTemplate, string> = {
  [AgentTeamTemplate.GENERIC_OPERATIONS]: 'Generic operations',
  [AgentTeamTemplate.TIKTOK_MARKETING]: 'TikTok marketing'
};

export const agentTeamStatusLabels: Record<AgentTeamStatus, string> = {
  [AgentTeamStatus.DRAFT]: 'Draft',
  [AgentTeamStatus.PROVISIONING]: 'Provisioning',
  [AgentTeamStatus.ACTIVE]: 'Active',
  [AgentTeamStatus.PAUSED]: 'Paused',
  [AgentTeamStatus.DEGRADED]: 'Degraded',
  [AgentTeamStatus.FAILED]: 'Failed',
  [AgentTeamStatus.ARCHIVED]: 'Archived'
};

export const agentRuntimeProviderLabels: Record<AgentRuntimeProvider, string> =
  {
    [AgentRuntimeProvider.KILOCLAW]: 'KiloClaw (legacy)',
    [AgentRuntimeProvider.E2B]: 'E2B Desktop',
    [AgentRuntimeProvider.SELF_HOSTED]: 'Self-hosted'
  };

export const agentRuntimeStatusLabels: Record<AgentRuntimeStatus, string> = {
  [AgentRuntimeStatus.PENDING]: 'Pending',
  [AgentRuntimeStatus.READY]: 'Ready',
  [AgentRuntimeStatus.DEGRADED]: 'Degraded',
  [AgentRuntimeStatus.FAILED]: 'Failed',
  [AgentRuntimeStatus.STOPPED]: 'Stopped'
};

export const agentDeploymentStatusLabels: Record<
  AgentDeploymentStatus,
  string
> = {
  [AgentDeploymentStatus.QUEUED]: 'Queued',
  [AgentDeploymentStatus.PROVISIONING]: 'Provisioning',
  [AgentDeploymentStatus.READY]: 'Ready',
  [AgentDeploymentStatus.DEGRADED]: 'Degraded',
  [AgentDeploymentStatus.FAILED]: 'Failed',
  [AgentDeploymentStatus.STOPPED]: 'Stopped',
  [AgentDeploymentStatus.REDEPLOY_REQUIRED]: 'Redeploy required'
};

export const agentRunStatusLabels: Record<AgentRunStatus, string> = {
  [AgentRunStatus.QUEUED]: 'Queued',
  [AgentRunStatus.RUNNING]: 'Running',
  [AgentRunStatus.SUCCEEDED]: 'Succeeded',
  [AgentRunStatus.FAILED]: 'Failed',
  [AgentRunStatus.WAITING_APPROVAL]: 'Waiting for approval',
  [AgentRunStatus.CANCELLED]: 'Cancelled'
};

export const approvalRequestStatusLabels: Record<
  ApprovalRequestStatus,
  string
> = {
  [ApprovalRequestStatus.PENDING]: 'Pending',
  [ApprovalRequestStatus.APPROVED]: 'Approved',
  [ApprovalRequestStatus.REJECTED]: 'Rejected',
  [ApprovalRequestStatus.EXPIRED]: 'Expired',
  [ApprovalRequestStatus.CANCELLED]: 'Cancelled'
};

export const approvalRiskLevelLabels: Record<ApprovalRiskLevel, string> = {
  [ApprovalRiskLevel.LOW]: 'Low',
  [ApprovalRiskLevel.MEDIUM]: 'Medium',
  [ApprovalRiskLevel.HIGH]: 'High',
  [ApprovalRiskLevel.CRITICAL]: 'Critical'
};

export const providerConnectionTypeLabels: Record<
  ProviderConnectionType,
  string
> = {
  [ProviderConnectionType.KILO]: 'Kilo (legacy)',
  [ProviderConnectionType.E2B]: 'E2B',
  [ProviderConnectionType.OPENCLAW]: 'OpenClaw',
  [ProviderConnectionType.OPENAI]: 'OpenAI',
  [ProviderConnectionType.KERNEL]: 'Kernel (legacy)',
  [ProviderConnectionType.TELEGRAM]: 'Telegram',
  [ProviderConnectionType.TIKTOK]: 'TikTok'
};

export const providerConnectionStatusLabels: Record<
  ProviderConnectionStatus,
  string
> = {
  [ProviderConnectionStatus.DISCONNECTED]: 'Disconnected',
  [ProviderConnectionStatus.CONNECTING]: 'Connecting',
  [ProviderConnectionStatus.CONNECTED]: 'Connected',
  [ProviderConnectionStatus.ERROR]: 'Error'
};

export const agentControlChannelTypeLabels: Record<
  AgentControlChannelType,
  string
> = {
  [AgentControlChannelType.TELEGRAM]: 'Telegram'
};

export const agentControlChannelStatusLabels: Record<
  AgentControlChannelStatus,
  string
> = {
  [AgentControlChannelStatus.ACTIVE]: 'Active',
  [AgentControlChannelStatus.PAUSED]: 'Paused',
  [AgentControlChannelStatus.ERROR]: 'Error'
};

export const browserProfileStatusLabels: Record<BrowserProfileStatus, string> =
  {
    [BrowserProfileStatus.READY]: 'Ready',
    [BrowserProfileStatus.REQUIRES_LOGIN]: 'Requires login',
    [BrowserProfileStatus.SYNCING]: 'Syncing',
    [BrowserProfileStatus.ERROR]: 'Error',
    [BrowserProfileStatus.ARCHIVED]: 'Archived'
  };

export const agentRoleLabels: Record<AgentRole, string> = {
  [AgentRole.SUPERVISOR]: 'Supervisor',
  [AgentRole.RESEARCHER]: 'Researcher',
  [AgentRole.CREATOR]: 'Creator',
  [AgentRole.REVIEWER]: 'Reviewer',
  [AgentRole.PUBLISHER]: 'Publisher'
};
