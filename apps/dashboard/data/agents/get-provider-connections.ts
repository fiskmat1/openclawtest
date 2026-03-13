import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { prisma } from '@workspace/database/client';

import { Caching, OrganizationCacheKey } from '~/data/caching';
import type { ProviderConnectionDto } from '~/types/dtos/provider-connection-dto';
import { SortDirection } from '~/types/sort-direction';

async function getProviderConnectionsData(
  organizationId: string
): Promise<ProviderConnectionDto[]> {
  'use cache';
  cacheLife('default');
  cacheTag(
    Caching.createOrganizationTag(
      OrganizationCacheKey.AgentIntegrations,
      organizationId
    )
  );

  const connections = await prisma.providerConnection.findMany({
    where: { organizationId },
    select: {
      id: true,
      type: true,
      name: true,
      status: true,
      externalAccountId: true,
      externalWorkspaceId: true,
      encryptedAccessToken: true,
      encryptedRefreshToken: true,
      encryptedSecret: true,
      lastVerifiedAt: true,
      updatedAt: true
    },
    orderBy: [
      {
        type: SortDirection.Asc
      },
      {
        updatedAt: SortDirection.Desc
      }
    ]
  });

  return connections.map((connection) => ({
    id: connection.id,
    type: connection.type,
    name: connection.name,
    status: connection.status,
    externalAccountId: connection.externalAccountId ?? undefined,
    externalWorkspaceId: connection.externalWorkspaceId ?? undefined,
    hasAccessToken: Boolean(connection.encryptedAccessToken),
    hasRefreshToken: Boolean(connection.encryptedRefreshToken),
    hasSecret: Boolean(connection.encryptedSecret),
    lastVerifiedAt: connection.lastVerifiedAt ?? undefined,
    updatedAt: connection.updatedAt
  }));
}

export async function getProviderConnections(): Promise<ProviderConnectionDto[]> {
  const ctx = await getAuthOrganizationContext();
  return getProviderConnectionsData(ctx.organization.id);
}
