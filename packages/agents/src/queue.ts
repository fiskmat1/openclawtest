import { z } from 'zod';

export const AgentJobName = {
  DeployTeam: 'agents.deploy-team',
  ReconcileRuntime: 'agents.reconcile-runtime',
  SuperviseTeam: 'agents.supervise-team',
  SupervisorTick: 'agents.supervisor-tick',
  HeartbeatRuntime: 'agents.heartbeat-runtime',
  RecoverTeam: 'agents.recover-team',
  CleanupRuntime: 'agents.cleanup-runtime',
  PublishArtifact: 'agents.publish-artifact',
  CheckPublishStatus: 'agents.check-publish-status',
  ProcessProviderWebhook: 'agents.process-provider-webhook',
  ResolveApprovalTimeout: 'agents.resolve-approval-timeout'
} as const;

export type AgentJobName = (typeof AgentJobName)[keyof typeof AgentJobName];

const uuid = z.uuid();

export const deployTeamJobPayloadSchema = z.object({
  organizationId: uuid,
  teamId: uuid,
  deploymentId: uuid,
  requestedByUserId: uuid.optional()
});

export const reconcileRuntimeJobPayloadSchema = z.object({
  organizationId: uuid,
  teamId: uuid,
  runtimeId: uuid
});

export const superviseTeamJobPayloadSchema = z.object({
  organizationId: uuid,
  teamId: uuid,
  runId: uuid.optional(),
  reason: z.string().min(1).max(255).default('scheduled')
});

export const publishArtifactJobPayloadSchema = z.object({
  organizationId: uuid,
  teamId: uuid,
  artifactId: uuid,
  runId: uuid.optional(),
  approvalRequestId: uuid.optional()
});

export const heartbeatRuntimeJobPayloadSchema = z.object({
  organizationId: uuid,
  teamId: uuid,
  runtimeId: uuid
});

export const supervisorTickJobPayloadSchema = z.object({
  organizationId: uuid,
  teamId: uuid,
  runtimeId: uuid.optional(),
  reason: z.string().min(1).max(255).default('continuous')
});

export const recoverTeamJobPayloadSchema = z.object({
  organizationId: uuid,
  teamId: uuid,
  runtimeId: uuid.optional(),
  reason: z.string().min(1).max(255).default('recovery')
});

export const cleanupRuntimeJobPayloadSchema = z.object({
  organizationId: uuid,
  teamId: uuid,
  runtimeId: uuid
});

export const checkPublishStatusJobPayloadSchema = z.object({
  organizationId: uuid,
  artifactId: uuid,
  runId: uuid.optional()
});

export const processProviderWebhookJobPayloadSchema = z.object({
  organizationId: uuid.optional(),
  teamId: uuid.optional(),
  runtimeId: uuid.optional(),
  deploymentId: uuid.optional(),
  providerConnectionId: uuid.optional(),
  channelId: uuid.optional(),
  sessionKey: z.string().trim().min(1).max(255).optional(),
  provider: z.enum(['kilo', 'e2b', 'openclaw', 'kernel', 'telegram', 'tiktok']),
  payload: z.record(z.string(), z.unknown())
});

export const resolveApprovalTimeoutJobPayloadSchema = z.object({
  organizationId: uuid,
  approvalRequestId: uuid
});

export const agentJobSchemas = {
  [AgentJobName.DeployTeam]: deployTeamJobPayloadSchema,
  [AgentJobName.ReconcileRuntime]: reconcileRuntimeJobPayloadSchema,
  [AgentJobName.SuperviseTeam]: superviseTeamJobPayloadSchema,
  [AgentJobName.SupervisorTick]: supervisorTickJobPayloadSchema,
  [AgentJobName.HeartbeatRuntime]: heartbeatRuntimeJobPayloadSchema,
  [AgentJobName.RecoverTeam]: recoverTeamJobPayloadSchema,
  [AgentJobName.CleanupRuntime]: cleanupRuntimeJobPayloadSchema,
  [AgentJobName.PublishArtifact]: publishArtifactJobPayloadSchema,
  [AgentJobName.CheckPublishStatus]: checkPublishStatusJobPayloadSchema,
  [AgentJobName.ProcessProviderWebhook]: processProviderWebhookJobPayloadSchema,
  [AgentJobName.ResolveApprovalTimeout]: resolveApprovalTimeoutJobPayloadSchema
} as const;

export type DeployTeamJobPayload = z.infer<typeof deployTeamJobPayloadSchema>;
export type ReconcileRuntimeJobPayload = z.infer<
  typeof reconcileRuntimeJobPayloadSchema
>;
export type SuperviseTeamJobPayload = z.infer<
  typeof superviseTeamJobPayloadSchema
>;
export type PublishArtifactJobPayload = z.infer<
  typeof publishArtifactJobPayloadSchema
>;
export type HeartbeatRuntimeJobPayload = z.infer<
  typeof heartbeatRuntimeJobPayloadSchema
>;
export type SupervisorTickJobPayload = z.infer<
  typeof supervisorTickJobPayloadSchema
>;
export type RecoverTeamJobPayload = z.infer<typeof recoverTeamJobPayloadSchema>;
export type CleanupRuntimeJobPayload = z.infer<
  typeof cleanupRuntimeJobPayloadSchema
>;
export type CheckPublishStatusJobPayload = z.infer<
  typeof checkPublishStatusJobPayloadSchema
>;
export type ProcessProviderWebhookJobPayload = z.infer<
  typeof processProviderWebhookJobPayloadSchema
>;
export type ResolveApprovalTimeoutJobPayload = z.infer<
  typeof resolveApprovalTimeoutJobPayloadSchema
>;

export function parseAgentJobPayload<TName extends AgentJobName>(
  jobName: TName,
  payload: unknown
): z.infer<(typeof agentJobSchemas)[TName]> {
  return agentJobSchemas[jobName].parse(payload) as z.infer<
    (typeof agentJobSchemas)[TName]
  >;
}
