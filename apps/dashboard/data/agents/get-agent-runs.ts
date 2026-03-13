import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { prisma } from '@workspace/database/client';

import { Caching, OrganizationCacheKey } from '~/data/caching';
import type { AgentRunDto } from '~/types/dtos/agent-run-dto';
import { SortDirection } from '~/types/sort-direction';

async function getAgentRunsData(organizationId: string): Promise<AgentRunDto[]> {
  'use cache';
  cacheLife('default');
  cacheTag(
    Caching.createOrganizationTag(OrganizationCacheKey.AgentRuns, organizationId)
  );

  const runs = await prisma.agentRun.findMany({
    where: { organizationId },
    select: {
      id: true,
      status: true,
      trigger: true,
      title: true,
      summary: true,
      objective: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      team: {
        select: {
          id: true,
          name: true
        }
      },
      artifacts: {
        select: {
          type: true
        }
      },
      _count: {
        select: {
          steps: true,
          approvals: true
        }
      }
    },
    orderBy: {
      createdAt: SortDirection.Desc
    }
  });

  return runs.map((run) => ({
    id: run.id,
    teamId: run.team.id,
    teamName: run.team.name,
    status: run.status,
    trigger: run.trigger,
    title: run.title ?? undefined,
    summary: run.summary ?? undefined,
    objective: run.objective ?? undefined,
    artifactTypes: [...new Set(run.artifacts.map((artifact) => artifact.type))],
    stepCount: run._count.steps,
    approvalCount: run._count.approvals,
    startedAt: run.startedAt ?? undefined,
    completedAt: run.completedAt ?? undefined,
    createdAt: run.createdAt
  }));
}

export async function getAgentRuns(): Promise<AgentRunDto[]> {
  const ctx = await getAuthOrganizationContext();
  return getAgentRunsData(ctx.organization.id);
}
