import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { AgentArtifactType } from '@workspace/database';
import { prisma } from '@workspace/database/client';

import { Caching, OrganizationCacheKey } from '~/data/caching';
import { toJsonRecord } from '~/data/agents/_helpers';
import type { AgentArtifactDto } from '~/types/dtos/agent-artifact-dto';
import { SortDirection } from '~/types/sort-direction';

async function getAgentArtifactsData(
  organizationId: string
): Promise<AgentArtifactDto[]> {
  'use cache';
  cacheLife('default');
  cacheTag(
    Caching.createOrganizationTag(
      OrganizationCacheKey.AgentRuns,
      organizationId,
      'artifacts'
    )
  );

  const artifacts = await prisma.agentArtifact.findMany({
    where: {
      organizationId,
      type: {
        in: [AgentArtifactType.VIDEO, AgentArtifactType.SCRIPT, AgentArtifactType.CAPTION]
      }
    },
    select: {
      id: true,
      runId: true,
      teamId: true,
      title: true,
      type: true,
      url: true,
      textContent: true,
      externalId: true,
      metadata: true,
      createdAt: true
    },
    orderBy: {
      createdAt: SortDirection.Desc
    },
    take: 20
  });

  return artifacts.map((artifact) => ({
    id: artifact.id,
    runId: artifact.runId ?? undefined,
    teamId: artifact.teamId ?? undefined,
    title: artifact.title,
    type: artifact.type,
    url: artifact.url ?? undefined,
    textContent: artifact.textContent ?? undefined,
    externalId: artifact.externalId ?? undefined,
    metadata: toJsonRecord(artifact.metadata),
    createdAt: artifact.createdAt
  }));
}

export async function getAgentArtifacts(): Promise<AgentArtifactDto[]> {
  const ctx = await getAuthOrganizationContext();
  return getAgentArtifactsData(ctx.organization.id);
}
