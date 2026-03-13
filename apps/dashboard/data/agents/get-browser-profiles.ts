import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { prisma } from '@workspace/database/client';

import { Caching, OrganizationCacheKey } from '~/data/caching';
import type { BrowserProfileDto } from '~/types/dtos/browser-profile-dto';
import { SortDirection } from '~/types/sort-direction';

async function getBrowserProfilesData(
  organizationId: string
): Promise<BrowserProfileDto[]> {
  'use cache';
  cacheLife('default');
  cacheTag(
    Caching.createOrganizationTag(
      OrganizationCacheKey.AgentBrowserProfiles,
      organizationId
    )
  );

  const profiles = await prisma.browserProfile.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      provider: true,
      status: true,
      externalProfileId: true,
      saveChanges: true,
      managedAuth: true,
      lastSyncedAt: true,
      team: {
        select: {
          name: true
        }
      }
    },
    orderBy: {
      createdAt: SortDirection.Desc
    }
  });

  return profiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    provider: profile.provider,
    status: profile.status,
    externalProfileId: profile.externalProfileId ?? undefined,
    teamName: profile.team?.name ?? undefined,
    saveChanges: profile.saveChanges,
    managedAuth: profile.managedAuth,
    lastSyncedAt: profile.lastSyncedAt ?? undefined
  }));
}

export async function getBrowserProfiles(): Promise<BrowserProfileDto[]> {
  const ctx = await getAuthOrganizationContext();
  return getBrowserProfilesData(ctx.organization.id);
}
