'use server';

import { sendAgentJob } from '@workspace/agents/boss';
import { AgentJobName } from '@workspace/agents/queue';
import {
  AgentAuditEventType,
  AgentRunStatus,
  ApprovalRequestKind,
  ApprovalRequestStatus
} from '@workspace/database';
import { prisma } from '@workspace/database/client';

import { authOrganizationActionClient } from '~/actions/safe-action';
import {
  assertCanManageAgents,
  updateAgentCacheTags
} from '~/actions/agents/_helpers';
import { resolveApprovalRequestSchema } from '~/schemas/agents/resolve-approval-request-schema';

function toRequestedAction(
  value: unknown
): { artifactId?: string } | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as { artifactId?: string };
}

export const resolveApprovalRequest = authOrganizationActionClient
  .metadata({ actionName: 'resolveApprovalRequest' })
  .inputSchema(resolveApprovalRequestSchema)
  .action(async ({ parsedInput, ctx }) => {
    assertCanManageAgents(ctx);

    const request = await prisma.approvalRequest.findFirst({
      where: {
        id: parsedInput.id,
        organizationId: ctx.organization.id
      }
    });

    if (!request) {
      throw new Error('Approval request not found.');
    }

    const nextStatus = parsedInput.approved
      ? ApprovalRequestStatus.APPROVED
      : ApprovalRequestStatus.REJECTED;

    await prisma.approvalRequest.update({
      where: { id: request.id },
      data: {
        status: nextStatus,
        reviewedByUserId: ctx.session.user.id,
        resolvedAt: new Date(),
        decisionReason: parsedInput.decisionReason ?? null
      }
    });

    if (request.runId) {
      await prisma.agentRun.update({
        where: { id: request.runId },
        data: {
          status: parsedInput.approved
            ? AgentRunStatus.RUNNING
            : AgentRunStatus.FAILED,
          summary: parsedInput.approved
            ? 'Approval granted. Continuing automated workflow.'
            : 'Approval rejected by an organization admin.'
        }
      });
    }

    await prisma.agentAuditLog.create({
      data: {
        organizationId: ctx.organization.id,
        teamId: request.teamId,
        runId: request.runId ?? null,
        actorUserId: ctx.session.user.id,
        eventType: AgentAuditEventType.APPROVAL_RESOLVED,
        summary: `${parsedInput.approved ? 'Approved' : 'Rejected'} ${request.title}.`,
        metadata: {
          approvalRequestId: request.id,
          decisionReason: parsedInput.decisionReason
        }
      },
      select: {
        id: true
      }
    });

    if (
      parsedInput.approved &&
      request.kind === ApprovalRequestKind.PUBLISH_CONTENT
    ) {
      const requestedAction = toRequestedAction(request.requestedAction);

      if (requestedAction?.artifactId) {
        await sendAgentJob(AgentJobName.PublishArtifact, {
          organizationId: ctx.organization.id,
          teamId: request.teamId,
          artifactId: requestedAction.artifactId,
          runId: request.runId ?? undefined,
          approvalRequestId: request.id
        });
      }
    }

    updateAgentCacheTags(ctx.organization.id);

    return {
      status: nextStatus
    };
  });
