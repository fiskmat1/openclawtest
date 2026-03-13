import { z } from 'zod';

export const AgentJobName = {
  DeployTeam: 'agents.deploy-team',
  ReconcileRuntime: 'agents.reconcile-runtime',
  SuperviseTeam: 'agents.supervise-team',
  PublishArtifact: 'agents.publish-artifact',
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

export const processProviderWebhookJobPayloadSchema = z.object({
  organizationId: uuid.optional(),
  provider: z.enum(['kilo', 'openclaw', 'kernel', 'tiktok']),
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
  [AgentJobName.PublishArtifact]: publishArtifactJobPayloadSchema,
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
