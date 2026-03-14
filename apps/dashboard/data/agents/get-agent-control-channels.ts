import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { prisma } from '@workspace/database/client';

import { Caching, OrganizationCacheKey } from '~/data/caching';
import type { AgentControlChannelDto } from '~/types/dtos/agent-control-channel-dto';
import { SortDirection } from '~/types/sort-direction';

async function getAgentControlChannelsData(
  organizationId: string
): Promise<AgentControlChannelDto[]> {
  'use cache';
  cacheLife('default');
  cacheTag(
    Caching.createOrganizationTag(
      OrganizationCacheKey.AgentIntegrations,
      organizationId
    )
  );

  const channels = await prisma.agentControlChannel.findMany({
    where: {
      organizationId
    },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      externalChannelId: true,
      externalThreadId: true,
      lastInboundAt: true,
      lastOutboundAt: true,
      team: {
        select: {
          name: true
        }
      },
      runtime: {
        select: {
          name: true
        }
      },
      providerConnection: {
        select: {
          name: true
        }
      }
    },
    orderBy: {
      updatedAt: SortDirection.Desc
    }
  });

  return channels.map((channel) => ({
    id: channel.id,
    name: channel.name,
    type: channel.type,
    status: channel.status,
    teamName: channel.team.name,
    providerConnectionName: channel.providerConnection.name,
    externalChannelId: channel.externalChannelId,
    externalThreadId: channel.externalThreadId ?? undefined,
    runtimeName: channel.runtime?.name ?? undefined,
    lastInboundAt: channel.lastInboundAt ?? undefined,
    lastOutboundAt: channel.lastOutboundAt ?? undefined
  }));
}

export async function getAgentControlChannels(): Promise<
  AgentControlChannelDto[]
> {
  const ctx = await getAuthOrganizationContext();
  return getAgentControlChannelsData(ctx.organization.id);
}
