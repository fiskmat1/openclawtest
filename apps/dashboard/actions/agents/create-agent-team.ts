'use server';

import {
  createGenericOperationsBlueprint,
  createTeamSlug,
  createTikTokMarketingBlueprint
} from '@workspace/agents';
import {
  AgentAuditEventType,
  AgentRole,
  AgentStatus,
  AgentTeamTemplate
} from '@workspace/database';
import { prisma } from '@workspace/database/client';

import { authOrganizationActionClient } from '~/actions/safe-action';
import {
  assertCanManageAgents,
  syncTeamCadenceSchedule,
  updateAgentCacheTags
} from '~/actions/agents/_helpers';
import { createAgentTeamSchema } from '~/schemas/agents/create-agent-team-schema';

function getBlueprint(
  template: AgentTeamTemplate,
  organizationName: string
) {
  return template === AgentTeamTemplate.TIKTOK_MARKETING
    ? createTikTokMarketingBlueprint(organizationName)
    : createGenericOperationsBlueprint(organizationName);
}

async function createUniqueTeamSlug(
  organizationId: string,
  name: string
): Promise<string> {
  const baseSlug = createTeamSlug(name);
  let candidate = baseSlug;
  let suffix = 2;

  while (
    await prisma.agentTeam.findFirst({
      where: {
        organizationId,
        slug: candidate
      },
      select: {
        id: true
      }
    })
  ) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export const createAgentTeam = authOrganizationActionClient
  .metadata({ actionName: 'createAgentTeam' })
  .inputSchema(createAgentTeamSchema)
  .action(async ({ parsedInput, ctx }) => {
    assertCanManageAgents(ctx);

    const blueprint = getBlueprint(parsedInput.template, ctx.organization.name);
    const slug = await createUniqueTeamSlug(ctx.organization.id, parsedInput.name);

    const team = await prisma.$transaction(async (tx) => {
      const createdTeam = await tx.agentTeam.create({
        data: {
          organizationId: ctx.organization.id,
          name: parsedInput.name,
          slug,
          template: parsedInput.template,
          description: parsedInput.description ?? blueprint.description,
          desiredOutcome:
            parsedInput.desiredOutcome ?? blueprint.desiredOutcome,
          cadenceCron: parsedInput.cadenceCron ?? blueprint.cadenceCron,
          approvalPolicy: blueprint.approvalPolicy,
          promptPack: blueprint.promptPack,
          skillPack: blueprint.skillPack
        },
        select: {
          id: true,
          cadenceCron: true
        }
      });

      await tx.agent.createMany({
        data: blueprint.agents.map((agent) => ({
          organizationId: ctx.organization.id,
          teamId: createdTeam.id,
          name: agent.name,
          role: agent.role,
          systemPrompt: agent.systemPrompt,
          goal: agent.goal,
          status: AgentStatus.IDLE
        }))
      });

      await tx.agentAuditLog.create({
        data: {
          organizationId: ctx.organization.id,
          teamId: createdTeam.id,
          actorUserId: ctx.session.user.id,
          eventType: AgentAuditEventType.TEAM_CREATED,
          summary: `Created ${parsedInput.template === AgentTeamTemplate.TIKTOK_MARKETING ? 'TikTok marketing' : 'operations'} team ${parsedInput.name}.`,
          metadata: {
            slug,
            template: parsedInput.template,
            agentRoles: blueprint.agents.map((agent) => agent.role)
          }
        },
        select: {
          id: true
        }
      });

      return createdTeam;
    });

    await syncTeamCadenceSchedule({
      organizationId: ctx.organization.id,
      teamId: team.id,
      cron: team.cadenceCron
    });

    updateAgentCacheTags(ctx.organization.id);

    return {
      teamId: team.id
    };
  });
