import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { ApprovalRequestStatus } from '@workspace/database';
import { prisma } from '@workspace/database/client';

import { Caching, OrganizationCacheKey } from '~/data/caching';
import type { AgentTeamDto } from '~/types/dtos/agent-team-dto';
import { SortDirection } from '~/types/sort-direction';

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function getAgentTeamsData(
  organizationId: string
): Promise<AgentTeamDto[]> {
  'use cache';
  cacheLife('default');
  cacheTag(
    Caching.createOrganizationTag(
      OrganizationCacheKey.AgentTeams,
      organizationId
    )
  );

  const teams = await prisma.agentTeam.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      template: true,
      status: true,
      description: true,
      desiredOutcome: true,
      teamSpec: true,
      supervisorConfig: true,
      cadenceCron: true,
      lastRunAt: true,
      nextRunAt: true,
      agents: {
        select: {
          role: true
        }
      },
      approvals: {
        where: {
          status: ApprovalRequestStatus.PENDING
        },
        select: {
          id: true
        }
      },
      runtimes: {
        select: {
          id: true
        }
      },
      deployments: {
        take: 1,
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          status: true
        }
      }
    },
    orderBy: {
      createdAt: SortDirection.Asc
    }
  });

  return teams.map((team) => {
    const teamSpec = toRecord(team.teamSpec);
    const supervisorConfig = toRecord(team.supervisorConfig);

    return {
      id: team.id,
      name: team.name,
      slug: team.slug,
      template: team.template,
      status: team.status,
      description: team.description ?? undefined,
      desiredOutcome: team.desiredOutcome ?? undefined,
      cadenceCron: team.cadenceCron ?? undefined,
      lastRunAt: team.lastRunAt ?? undefined,
      nextRunAt: team.nextRunAt ?? undefined,
      mission:
        typeof teamSpec.mission === 'string' ? teamSpec.mission : undefined,
      operatingDomains: Array.isArray(teamSpec.operatingDomains)
        ? teamSpec.operatingDomains.filter(
            (value): value is string => typeof value === 'string'
          )
        : [],
      autonomyLevel:
        typeof teamSpec.autonomyLevel === 'string'
          ? (teamSpec.autonomyLevel as AgentTeamDto['autonomyLevel'])
          : undefined,
      telegramEnabled:
        typeof teamSpec.telegramEnabled === 'boolean'
          ? teamSpec.telegramEnabled
          : typeof supervisorConfig.telegramControlEnabled === 'boolean'
            ? supervisorConfig.telegramControlEnabled
            : false,
      browserEnabled:
        typeof teamSpec.browserEnabled === 'boolean'
          ? teamSpec.browserEnabled
          : typeof supervisorConfig.browserEnabled === 'boolean'
            ? supervisorConfig.browserEnabled
            : false,
      runtimeCount: team.runtimes.length,
      agentCount: team.agents.length,
      pendingApprovalCount: team.approvals.length,
      latestDeploymentStatus: team.deployments[0]?.status,
      primaryRoles: [...new Set(team.agents.map((agent) => agent.role))]
    };
  });
}

export async function getAgentTeams(): Promise<AgentTeamDto[]> {
  const ctx = await getAuthOrganizationContext();
  return getAgentTeamsData(ctx.organization.id);
}
