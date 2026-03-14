'use server';

import { AgentJobName, sendAgentJob } from '@workspace/agents';
import {
  AgentDeploymentStatus,
  AgentRuntimeProvider,
  AgentTeamStatus
} from '@workspace/database';
import { prisma } from '@workspace/database/client';

import {
  assertCanManageAgents,
  updateAgentCacheTags
} from '~/actions/agents/_helpers';
import { authOrganizationActionClient } from '~/actions/safe-action';
import { requestAgentDeploymentSchema } from '~/schemas/agents/request-agent-deployment-schema';

export const requestAgentDeployment = authOrganizationActionClient
  .metadata({ actionName: 'requestAgentDeployment' })
  .inputSchema(requestAgentDeploymentSchema)
  .action(async ({ parsedInput, ctx }) => {
    assertCanManageAgents(ctx);

    const team = await prisma.agentTeam.findFirst({
      where: {
        id: parsedInput.teamId,
        organizationId: ctx.organization.id
      },
      select: {
        id: true
      }
    });

    if (!team) {
      throw new Error('Agent team not found.');
    }

    const deployment = await prisma.agentDeployment.create({
      data: {
        organizationId: ctx.organization.id,
        teamId: team.id,
        provider: parsedInput.provider ?? AgentRuntimeProvider.E2B,
        status: AgentDeploymentStatus.QUEUED,
        providerConnectionId: parsedInput.providerConnectionId ?? null,
        requestedByUserId: ctx.session.user.id
      },
      select: {
        id: true
      }
    });

    await prisma.agentTeam.update({
      where: { id: team.id },
      data: {
        status: AgentTeamStatus.PROVISIONING
      }
    });

    await sendAgentJob(AgentJobName.DeployTeam, {
      organizationId: ctx.organization.id,
      teamId: team.id,
      deploymentId: deployment.id,
      requestedByUserId: ctx.session.user.id
    });

    updateAgentCacheTags(ctx.organization.id);

    return {
      deploymentId: deployment.id
    };
  });
