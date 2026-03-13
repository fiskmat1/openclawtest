import { Prisma, type AgentAuditEventType } from '@workspace/database';
import { prisma } from '@workspace/database/client';

type CreateAgentAuditLogInput = {
  organizationId: string;
  teamId?: string | null;
  runId?: string | null;
  deploymentId?: string | null;
  actorUserId?: string | null;
  actorAgentId?: string | null;
  eventType: AgentAuditEventType;
  summary: string;
  metadata?: Record<string, unknown>;
};

export async function createAgentAuditLog(
  input: CreateAgentAuditLogInput
): Promise<void> {
  await prisma.agentAuditLog.create({
    data: {
      organizationId: input.organizationId,
      teamId: input.teamId ?? null,
      runId: input.runId ?? null,
      deploymentId: input.deploymentId ?? null,
      actorUserId: input.actorUserId ?? null,
      actorAgentId: input.actorAgentId ?? null,
      eventType: input.eventType,
      summary: input.summary,
      metadata: input.metadata
        ? (input.metadata as Prisma.InputJsonValue)
        : undefined
    },
    select: {
      id: true
    }
  });
}
