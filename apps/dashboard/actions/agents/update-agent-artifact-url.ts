'use server';

import { AgentAuditEventType } from '@workspace/database';
import { prisma } from '@workspace/database/client';

import { authOrganizationActionClient } from '~/actions/safe-action';
import {
  assertCanManageAgents,
  updateAgentCacheTags
} from '~/actions/agents/_helpers';
import { updateAgentArtifactUrlSchema } from '~/schemas/agents/update-agent-artifact-url-schema';

export const updateAgentArtifactUrl = authOrganizationActionClient
  .metadata({ actionName: 'updateAgentArtifactUrl' })
  .inputSchema(updateAgentArtifactUrlSchema)
  .action(async ({ parsedInput, ctx }) => {
    assertCanManageAgents(ctx);

    const artifact = await prisma.agentArtifact.findFirst({
      where: {
        id: parsedInput.artifactId,
        organizationId: ctx.organization.id
      },
      select: {
        id: true,
        teamId: true,
        runId: true,
        title: true
      }
    });

    if (!artifact) {
      throw new Error('Artifact not found.');
    }

    await prisma.agentArtifact.update({
      where: { id: artifact.id },
      data: {
        url: parsedInput.url
      }
    });

    await prisma.agentAuditLog.create({
      data: {
        organizationId: ctx.organization.id,
        teamId: artifact.teamId,
        runId: artifact.runId,
        actorUserId: ctx.session.user.id,
        eventType: AgentAuditEventType.RUN_STATE_TRANSITION,
        summary: `Attached source URL for ${artifact.title}.`,
        metadata: {
          artifactId: artifact.id
        }
      },
      select: {
        id: true
      }
    });

    updateAgentCacheTags(ctx.organization.id);

    return {
      artifactId: artifact.id
    };
  });
