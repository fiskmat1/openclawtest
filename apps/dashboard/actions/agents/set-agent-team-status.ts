'use server';

import { z } from 'zod';

import { sendAgentJob } from '@workspace/agents/boss';
import { AgentJobName } from '@workspace/agents/queue';
import {
  AgentAuditEventType,
  AgentTeamStatus,
  Prisma
} from '@workspace/database';
import { prisma } from '@workspace/database/client';

import {
  assertCanManageAgents,
  updateAgentCacheTags
} from '~/actions/agents/_helpers';
import { authOrganizationActionClient } from '~/actions/safe-action';

const setAgentTeamStatusSchema = z.object({
  teamId: z.uuid(),
  status: z.enum([AgentTeamStatus.ACTIVE, AgentTeamStatus.PAUSED])
});

export const setAgentTeamStatus = authOrganizationActionClient
  .metadata({ actionName: 'setAgentTeamStatus' })
  .inputSchema(setAgentTeamStatusSchema)
  .action(async ({ parsedInput, ctx }) => {
    assertCanManageAgents(ctx);

    const team = await prisma.agentTeam.findFirst({
      where: {
        id: parsedInput.teamId,
        organizationId: ctx.organization.id
      }
    });

    if (!team) {
      throw new Error('Agent team not found.');
    }

    await prisma.agentTeam.update({
      where: {
        id: team.id
      },
      data: {
        status: parsedInput.status
      }
    });

    await prisma.agentAuditLog.create({
      data: {
        organizationId: ctx.organization.id,
        teamId: team.id,
        actorUserId: ctx.session.user.id,
        eventType: AgentAuditEventType.RUN_STATE_TRANSITION,
        summary: `Team ${team.name} set to ${parsedInput.status.toLowerCase()}.`,
        metadata: {
          requestedStatus: parsedInput.status
        } as Prisma.InputJsonValue
      }
    });

    if (parsedInput.status === AgentTeamStatus.ACTIVE) {
      const runtime = await prisma.agentRuntime.findFirst({
        where: {
          teamId: team.id
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true
        }
      });

      await sendAgentJob(AgentJobName.SupervisorTick, {
        organizationId: ctx.organization.id,
        teamId: team.id,
        runtimeId: runtime?.id,
        reason: 'dashboard-resume'
      });
    }

    updateAgentCacheTags(ctx.organization.id);

    return {
      teamId: team.id
    };
  });
