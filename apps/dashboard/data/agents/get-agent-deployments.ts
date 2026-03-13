import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { prisma } from '@workspace/database/client';

import { Caching, OrganizationCacheKey } from '~/data/caching';
import type { AgentDeploymentDto } from '~/types/dtos/agent-deployment-dto';
import { SortDirection } from '~/types/sort-direction';

async function getAgentDeploymentsData(
  organizationId: string
): Promise<AgentDeploymentDto[]> {
  'use cache';
  cacheLife('default');
  cacheTag(
    Caching.createOrganizationTag(
      OrganizationCacheKey.AgentDeployments,
      organizationId
    )
  );

  const deployments = await prisma.agentDeployment.findMany({
    where: { organizationId },
    select: {
      id: true,
      provider: true,
      status: true,
      externalDeploymentId: true,
      createdAt: true,
      completedAt: true,
      failureReason: true,
      team: {
        select: {
          id: true,
          name: true
        }
      },
      runtime: {
        select: {
          name: true,
          controlUrl: true,
          region: true
        }
      }
    },
    orderBy: {
      createdAt: SortDirection.Desc
    }
  });

  return deployments.map((deployment) => ({
    id: deployment.id,
    teamId: deployment.team.id,
    teamName: deployment.team.name,
    provider: deployment.provider,
    status: deployment.status,
    runtimeName: deployment.runtime?.name ?? undefined,
    externalDeploymentId: deployment.externalDeploymentId ?? undefined,
    controlUrl: deployment.runtime?.controlUrl ?? undefined,
    region: deployment.runtime?.region ?? undefined,
    failureReason: deployment.failureReason ?? undefined,
    createdAt: deployment.createdAt,
    completedAt: deployment.completedAt ?? undefined
  }));
}

export async function getAgentDeployments(): Promise<AgentDeploymentDto[]> {
  const ctx = await getAuthOrganizationContext();
  return getAgentDeploymentsData(ctx.organization.id);
}
