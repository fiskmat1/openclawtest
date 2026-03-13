'use server';

import { AgentJobName, sendAgentJob } from '@workspace/agents';
import { AgentRunStatus, AgentRunTrigger } from '@workspace/database';
import { prisma } from '@workspace/database/client';

import { authOrganizationActionClient } from '~/actions/safe-action';
import {
  assertCanManageAgents,
  updateAgentCacheTags
} from '~/actions/agents/_helpers';
import { triggerAgentSupervisionSchema } from '~/schemas/agents/trigger-agent-supervision-schema';

export const triggerAgentSupervision = authOrganizationActionClient
  .metadata({ actionName: 'triggerAgentSupervision' })
  .inputSchema(triggerAgentSupervisionSchema)
  .action(async ({ parsedInput, ctx }) => {
    assertCanManageAgents(ctx);

    const team = await prisma.agentTeam.findFirst({
      where: {
        id: parsedInput.teamId,
        organizationId: ctx.organization.id
      },
      select: {
        id: true,
        runtimes: {
          take: 1,
          orderBy: {
            createdAt: 'desc'
          },
          select: {
            id: true
          }
        }
      }
    });

    if (!team) {
      throw new Error('Agent team not found.');
    }

    const run = await prisma.agentRun.create({
      data: {
        organizationId: ctx.organization.id,
        teamId: team.id,
        runtimeId: team.runtimes[0]?.id ?? null,
        status: AgentRunStatus.QUEUED,
        trigger: AgentRunTrigger.MANUAL,
        title: 'Manual supervision run',
        objective: parsedInput.reason,
        initiatedByUserId: ctx.session.user.id
      },
      select: {
        id: true
      }
    });

    await sendAgentJob(AgentJobName.SuperviseTeam, {
      organizationId: ctx.organization.id,
      teamId: team.id,
      runId: run.id,
      reason: parsedInput.reason
    });

    updateAgentCacheTags(ctx.organization.id);

    return {
      runId: run.id
    };
  });
