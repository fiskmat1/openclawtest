import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import {
  AgentRuntimeStatus,
  AgentTeamStatus,
  ApprovalRequestStatus,
  ProviderConnectionStatus
} from '@workspace/database';
import { prisma } from '@workspace/database/client';

import { Caching, OrganizationCacheKey } from '~/data/caching';
import type { AgentsOverviewDto } from '~/types/dtos/agents-overview-dto';

async function getAgentOverviewData(
  organizationId: string
): Promise<AgentsOverviewDto> {
  'use cache';
  cacheLife('default');
  cacheTag(
    Caching.createOrganizationTag(
      OrganizationCacheKey.AgentOverview,
      organizationId
    )
  );

  const [
    teamCount,
    activeTeamCount,
    runtimeReadyCount,
    pendingApprovalCount,
    connectedIntegrationCount,
    latestRun,
    latestDeployment
  ] = await Promise.all([
    prisma.agentTeam.count({
      where: { organizationId }
    }),
    prisma.agentTeam.count({
      where: {
        organizationId,
        status: AgentTeamStatus.ACTIVE
      }
    }),
    prisma.agentRuntime.count({
      where: {
        organizationId,
        status: AgentRuntimeStatus.READY
      }
    }),
    prisma.approvalRequest.count({
      where: {
        organizationId,
        status: ApprovalRequestStatus.PENDING
      }
    }),
    prisma.providerConnection.count({
      where: {
        organizationId,
        status: ProviderConnectionStatus.CONNECTED
      }
    }),
    prisma.agentRun.findFirst({
      where: { organizationId },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        team: {
          select: {
            name: true
          }
        }
      }
    }),
    prisma.agentDeployment.findFirst({
      where: { organizationId },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        team: {
          select: {
            name: true
          }
        }
      }
    })
  ]);

  return {
    teamCount,
    activeTeamCount,
    runtimeReadyCount,
    pendingApprovalCount,
    connectedIntegrationCount,
    latestRun: latestRun
      ? {
          id: latestRun.id,
          title: latestRun.title ?? 'Untitled run',
          teamName: latestRun.team.name,
          status: latestRun.status,
          createdAt: latestRun.createdAt
        }
      : undefined,
    latestDeployment: latestDeployment
      ? {
          id: latestDeployment.id,
          teamName: latestDeployment.team.name,
          status: latestDeployment.status,
          createdAt: latestDeployment.createdAt
        }
      : undefined
  };
}

export async function getAgentOverview(): Promise<AgentsOverviewDto> {
  const ctx = await getAuthOrganizationContext();
  return getAgentOverviewData(ctx.organization.id);
}
