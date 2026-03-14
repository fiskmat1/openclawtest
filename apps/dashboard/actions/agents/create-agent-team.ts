'use server';

import {
  planAgentTeamBlueprint,
  createTeamSlug,
} from '@workspace/agents/templates';
import {
  AgentAuditEventType,
  AgentStatus,
} from '@workspace/database';
import { prisma } from '@workspace/database/client';

import {
  assertCanManageAgents,
  maybeQueueAutoDeployForTeam,
  syncTeamCadenceSchedule,
  updateAgentCacheTags
} from '~/actions/agents/_helpers';
import { authOrganizationActionClient } from '~/actions/safe-action';
import { createAgentTeamSchema } from '~/schemas/agents/create-agent-team-schema';

function parseTextLines(value?: string): string[] {
  return (value ?? '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
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

    const blueprint = planAgentTeamBlueprint({
      organizationName: ctx.organization.name,
      name: parsedInput.name,
      template: parsedInput.template,
      description: parsedInput.description,
      desiredOutcome: parsedInput.desiredOutcome,
      mission: parsedInput.mission,
      cadenceCron: parsedInput.cadenceCron,
      autonomyLevel: parsedInput.autonomyLevel,
      operatingDomains: parseTextLines(parsedInput.operatingDomainsText),
      requestedRoles: parseTextLines(parsedInput.agentRoleHintsText),
      telegramEnabled: parsedInput.telegramEnabled,
      browserEnabled: parsedInput.browserEnabled,
      accountTargets: parseTextLines(parsedInput.accountTargetsText),
      allowedDomains: parseTextLines(parsedInput.allowedDomainsText),
      operatorInstructions: parsedInput.operatorInstructions
    });
    const slug = await createUniqueTeamSlug(
      ctx.organization.id,
      parsedInput.name
    );

    const team = await prisma.$transaction(async (tx) => {
      const createdTeam = await tx.agentTeam.create({
        data: {
          organizationId: ctx.organization.id,
          name: blueprint.name,
          slug,
          template: blueprint.template,
          description: blueprint.description,
          desiredOutcome: blueprint.desiredOutcome,
          teamSpec: blueprint.teamSpec,
          blueprint: blueprint,
          approvalPolicy: blueprint.approvalPolicy,
          promptPack: blueprint.promptPack,
          skillPack: blueprint.skillPack,
          cadenceCron: blueprint.cadenceCron,
          supervisorConfig: blueprint.supervisorConfig
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
          summary: `Created autonomous team ${blueprint.name}.`,
          metadata: {
            slug,
            template: blueprint.template,
            autonomyLevel: blueprint.teamSpec.autonomyLevel,
            operatingDomains: blueprint.teamSpec.operatingDomains,
            agentRoles: blueprint.agents.map((agent) => agent.role),
            supervisorProvider: blueprint.supervisorConfig.provider
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

    await maybeQueueAutoDeployForTeam({
      organizationId: ctx.organization.id,
      teamId: team.id,
      requestedByUserId: ctx.session.user.id
    });

    updateAgentCacheTags(ctx.organization.id);

    return {
      teamId: team.id
    };
  });
